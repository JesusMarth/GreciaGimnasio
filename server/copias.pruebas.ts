// Pruebas de la COPIA DE SEGURIDAD POR EMAIL (npm run test:copias).
// Levanta (1) un servidor SMTP de mentira en local que acepta cualquier correo y
// guarda lo que recibe, y (2) la app real en un puerto/carpeta temporales apuntando
// a ese SMTP. Comprueba de verdad que:
//  - el envío manual llega, con la base de datos adjunta, y ese adjunto es una BD
//    SQLite válida que se puede abrir y contiene los socios;
//  - sin cambios no se reenvía lo mismo (y a mano sí);
//  - al CERRAR la app se envía la copia (con los cambios nuevos);
//  - el estado (último envío, error) queda apuntado y se lee por la API;
//  - si el correo no está configurado, no revienta: queda el aviso.
import { spawn } from "node:child_process";
import { createServer, type Socket } from "node:net";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import Database from "better-sqlite3";

const PORT = 4797;
const SMTP_PORT = 4798;
const API = `http://localhost:${PORT}/api`;
const DATA = mkdtempSync(join(tmpdir(), "gymgrecia-copias-"));
const DESTINO = "gimnasiogrecialospalacios@gmail.com";

// ---------------------------------------------------------------------------
// SMTP de mentira: habla lo justo para que nodemailer entregue el mensaje.
// ---------------------------------------------------------------------------
interface Mensaje {
  de: string;
  para: string[];
  datos: string;
}
const recibidos: Mensaje[] = [];
const smtp = createServer((sock: Socket) => {
  let msg: Mensaje = { de: "", para: [], datos: "" };
  let enDatos = false;
  let buffer = "";
  sock.write("220 pruebas ESMTP\r\n");
  sock.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    if (enDatos) {
      const fin = buffer.indexOf("\r\n.\r\n");
      if (fin === -1) return;
      msg.datos = buffer.slice(0, fin);
      buffer = buffer.slice(fin + 5);
      enDatos = false;
      recibidos.push(msg);
      msg = { de: "", para: [], datos: "" };
      sock.write("250 OK guardado\r\n");
    }
    let nl: number;
    while (!enDatos && (nl = buffer.indexOf("\r\n")) !== -1) {
      const linea = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 2);
      const cmd = linea.toUpperCase();
      if (cmd.startsWith("EHLO") || cmd.startsWith("HELO")) sock.write("250-pruebas\r\n250-8BITMIME\r\n250 AUTH PLAIN LOGIN\r\n");
      else if (cmd.startsWith("AUTH")) sock.write("235 OK\r\n");
      else if (cmd.startsWith("MAIL FROM")) {
        msg.de = linea.slice(10).trim();
        sock.write("250 OK\r\n");
      } else if (cmd.startsWith("RCPT TO")) {
        msg.para.push(linea.slice(8).trim().replace(/[<>]/g, ""));
        sock.write("250 OK\r\n");
      } else if (cmd.startsWith("DATA")) {
        enDatos = true;
        sock.write("354 adelante\r\n");
      } else if (cmd.startsWith("QUIT")) {
        sock.write("221 adiós\r\n");
        sock.end();
      } else sock.write("250 OK\r\n");
    }
  });
  sock.on("error", () => {});
});

/** Saca el adjunto .db (base64) del mensaje MIME y lo devuelve como Buffer. */
function adjuntoDe(m: Mensaje): { nombre: string; datos: Buffer } | null {
  const i = m.datos.indexOf("Content-Disposition: attachment");
  if (i === -1) return null;
  const cabecera = m.datos.slice(Math.max(0, m.datos.lastIndexOf("\r\n--", i)), i + 400);
  const nombre = /filename="?([^"\r\n;]+)"?/.exec(cabecera)?.[1] ?? "";
  const inicio = m.datos.indexOf("\r\n\r\n", i) + 4;
  let fin = m.datos.indexOf("\r\n--", inicio);
  if (fin === -1) fin = m.datos.length;
  const b64 = m.datos.slice(inicio, fin).replace(/\s+/g, "");
  return { nombre, datos: Buffer.from(b64, "base64") };
}

// ---------------------------------------------------------------------------
// Arnés
// ---------------------------------------------------------------------------
let fallos = 0;
let total = 0;
function check(nombre: string, real: unknown, esperado: unknown) {
  total++;
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (!ok) {
    fallos++;
    console.error(`✗ ${nombre}\n    real: ${JSON.stringify(real)} · esperado: ${JSON.stringify(esperado)}`);
  }
}
const j = (r: Response) => r.json();
const GET = (p: string) => fetch(API + p).then(j);
const POST = (p: string, body: unknown = {}) =>
  fetch(API + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

function arrancarApp() {
  return spawn(process.execPath, ["--import", "tsx", resolve(import.meta.dirname, "index.ts")], {
    env: { ...process.env, GYM_DATA_DIR: DATA, GYM_API_PORT: String(PORT), GYM_NO_OPEN: "1", GYM_PRUEBAS: "1" },
    stdio: "ignore",
  });
}
async function esperarServidor() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(API + "/salud")).ok) return;
    } catch {
      /* arrancando */
    }
    await esperar(250);
  }
  throw new Error("La app de pruebas no arrancó en el puerto " + PORT);
}
async function esperarMensajes(n: number, ms = 10000) {
  const t0 = Date.now();
  while (recibidos.length < n && Date.now() - t0 < ms) await esperar(150);
  return recibidos.length >= n;
}

let app = arrancarApp();

async function main() {
  await new Promise<void>((ok) => smtp.listen(SMTP_PORT, "127.0.0.1", () => ok()));
  await esperarServidor();

  // A) Sin correo configurado: no revienta, queda el aviso.
  let cfg = await GET("/config/copias");
  check("A) destinatario por defecto = correo del gimnasio", cfg.email, DESTINO);
  check("A) activo por defecto", cfg.activo, true);
  check("A) correo de envío aún sin configurar", cfg.correoConfigurado, false);
  const sinCorreo = await POST("/config/copias/enviar");
  check("A) enviar sin SMTP → 400 con explicación", [sinCorreo.status, ((await sinCorreo.json()) as any).porQueNo], [400, "correo-no-configurado"]);
  cfg = await GET("/config/copias");
  check("A) el fallo queda apuntado", cfg.ultimoError.includes("no está configurado"), true);

  // B) Configurar SMTP (el de mentira) y un socio; envío manual → llega con la BD adjunta.
  await POST("/config/email", { host: "127.0.0.1", port: SMTP_PORT, secure: false, usuario: "gym@pruebas.local", pass: "x", remitente: "Gimnasio Pruebas" });
  const s1 = await (await POST("/socios", { nombre: "Ana", apellidos: "Copia", fechaAlta: "2026-09-03" })).json();
  const r1 = await POST("/config/copias/enviar");
  const j1 = (await r1.json()) as any;
  check("B) envío manual OK", [r1.status, j1.enviado, j1.para], [200, true, DESTINO]);
  check("B) el SMTP recibió 1 mensaje", await esperarMensajes(1), true);
  const m1 = recibidos[0];
  check("B) destinatario correcto", m1.para, [DESTINO]);
  // (nodemailer codifica el asunto por el «·»: los espacios salen como "_" en Q-encoding)
  check("B) asunto de copia", /Subject: .*Copia[ _]de[ _]seguridad[ _]GymGrecia/.test(m1.datos), true);
  check("B) el cuerpo explica cómo recuperar", m1.datos.includes("Restaurar"), true);
  const adj1 = adjuntoDe(m1);
  check("B) lleva adjunto .db", adj1?.nombre.startsWith("gymgrecia_") && adj1.nombre.endsWith(".db"), true);
  check("B) el adjunto es una base SQLite", adj1?.datos.subarray(0, 15).toString(), "SQLite format 3");
  check("B) tamaño coherente con lo que dice la API", adj1?.datos.length, j1.bytes);
  // Y se puede ABRIR y tiene los datos: eso es lo que salva al gimnasio.
  const ruta1 = join(DATA, "adjunto1.db");
  writeFileSync(ruta1, adj1!.datos);
  const bd1 = new Database(ruta1, { readonly: true });
  check("B) el adjunto se abre y contiene al socio", (bd1.prepare("SELECT nombre FROM socios").all() as any[]).map((x) => x.nombre), ["Ana"]);
  check("B) el adjunto tiene el esquema completo (tabla asistencias)", !!bd1.prepare("SELECT name FROM sqlite_master WHERE name='asistencias'").get(), true);
  bd1.close();
  cfg = await GET("/config/copias");
  check("B) último envío apuntado (hoy, manual, sin error)", [cfg.ultimoEnvio.slice(0, 10), cfg.ultimoMotivo, cfg.ultimoError], [new Date().toISOString().slice(0, 10), "manual", ""]);

  // C) Sin cambios no se reenvía lo mismo (salvo a mano, que siempre envía).
  const r2 = await POST("/config/copias/enviar");
  check("C) a mano siempre envía aunque no haya cambios", ((await r2.json()) as any).enviado, true);
  check("C) → 2 mensajes", await esperarMensajes(2), true);

  // D) Al CERRAR la app: se envía la copia con los cambios nuevos.
  await POST(`/socios/${s1.id}/suscripciones`, { actividad: "gimnasio", importe: 35, cobroInicial: { metodo: "efectivo" } });
  const salida = new Promise<number | null>((ok) => app.on("exit", (code) => ok(code)));
  await POST("/_cerrar");
  const codigo = await Promise.race([salida, esperar(15000).then(() => "timeout" as const)]);
  check("D) la app se cierra sola tras enviar", codigo, 0);
  check("D) el cierre envió la copia (3 mensajes)", await esperarMensajes(3, 2000), true);
  const adj3 = adjuntoDe(recibidos[2]);
  const ruta3 = join(DATA, "adjunto3.db");
  writeFileSync(ruta3, adj3!.datos);
  const bd3 = new Database(ruta3, { readonly: true });
  check("D) la copia del cierre incluye el cobro registrado justo antes", (bd3.prepare("SELECT COUNT(*) AS n FROM pagos").get() as any).n, 1);
  bd3.close();

  // E) Al arrancar de nuevo: hoy ya se envió → NO reenvía al arrancar; el estado dice "cierre".
  app = arrancarApp();
  await esperarServidor();
  cfg = await GET("/config/copias");
  check("E) el estado recuerda el envío del cierre", cfg.ultimoMotivo, "cierre");
  await esperar(9000); // el reintento de arranque salta a los 8 s si faltase el envío de hoy
  check("E) con el envío de hoy hecho no se reenvía al arrancar", recibidos.length, 3);

  // F) Envío al cerrar SIN cambios: no reenvía lo mismo, pero cierra bien.
  const salida2 = new Promise<number | null>((ok) => app.on("exit", (code) => ok(code)));
  await POST("/_cerrar");
  check("F) cierra bien", await Promise.race([salida2, esperar(15000).then(() => "timeout" as const)]), 0);
  await esperar(500);
  check("F) sin cambios, el cierre no manda un duplicado", recibidos.length, 3);

  // G) Destinatario inválido se rechaza; apagar el automático se respeta.
  app = arrancarApp();
  await esperarServidor();
  check("G) correo inválido → 400", (await POST("/config/copias", { email: "esto-no-es-un-correo" })).status, 400);
  await POST("/config/copias", { email: "otro@ejemplo.com", activo: false });
  cfg = await GET("/config/copias");
  check("G) se guarda destinatario y apagado", [cfg.email, cfg.activo], ["otro@ejemplo.com", false]);
  await POST("/socios", { nombre: "Beto", apellidos: "Cambio", fechaAlta: "2026-09-03" });
  const salida3 = new Promise<number | null>((ok) => app.on("exit", (code) => ok(code)));
  await POST("/_cerrar");
  await Promise.race([salida3, esperar(15000)]);
  await esperar(500);
  check("G) con el automático apagado, el cierre no envía", recibidos.length, 3);
}

main()
  .then(() => {
    console.log(fallos === 0 ? `✓ Copias por email: ${total} comprobaciones OK.` : `${fallos}/${total} comprobaciones fallan.`);
    process.exitCode = fallos === 0 ? 0 : 1;
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    try {
      app.kill();
    } catch {
      /* ya cerrada */
    }
    smtp.close();
    setTimeout(() => {
      try {
        rmSync(DATA, { recursive: true, force: true });
      } catch {
        /* temporal */
      }
    }, 500).unref();
  });
