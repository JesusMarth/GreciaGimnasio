// Pruebas de las casuísticas de INGRESOS vs. estado de cuota (npm run test:ingresos).
// Levanta un servidor real en un puerto/carpeta temporales (no toca datos de nadie),
// ejerce la API igual que la web y comprueba que:
//  - la cobertura "apuntada a mano" del alta NO genera ingresos (a propósito) y queda marcada;
//  - el cobro inicial del alta ("Cobrar ahora") SÍ genera un pago real;
//  - no hay duplicidad: cada euro de Ingresos corresponde a un pago registrado;
//  - borrar un pago restaura la cobertura manual del alta (no deja al socio "Sin pagar").
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { addMeses, hoyISO } from "./util.ts";

const PORT = 4799;
const API = `http://localhost:${PORT}/api`;
const DATA = mkdtempSync(join(tmpdir(), "gymgrecia-prueba-"));

const servidor = spawn(process.execPath, ["--import", "tsx", resolve(import.meta.dirname, "index.ts")], {
  env: { ...process.env, GYM_DATA_DIR: DATA, GYM_API_PORT: String(PORT), GYM_NO_OPEN: "1" },
  stdio: "ignore",
});

async function esperarServidor() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(API + "/salud");
      if (r.ok) return;
    } catch {
      /* aún arrancando */
    }
    await new Promise((ok) => setTimeout(ok, 250));
  }
  throw new Error("El servidor de pruebas no arrancó en el puerto " + PORT);
}

const j = (r: Response) => r.json();
const GET = (p: string) => fetch(API + p).then(j);
const POST = (p: string, body: unknown) =>
  fetch(API + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(j);
const PUT = (p: string, body: unknown) =>
  fetch(API + p, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(j);
const DEL = (p: string) => fetch(API + p, { method: "DELETE" }).then(j);

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

async function ingresosMes(): Promise<number> {
  return (await GET("/dashboard")).ingresosMes.total;
}

async function main() {
  await esperarServidor();
  const hoy = hoyISO();
  const mes = hoy.slice(0, 7);

  // A) Alta sin nada → "Sin pagar", 0 ingresos.
  const a = await POST("/socios", { nombre: "Ana", apellidos: "Pendiente", fechaAlta: hoy });
  await POST(`/socios/${a.id}/suscripciones`, { actividad: "gimnasio", importe: 35 });
  let s = await GET(`/socios/${a.id}`);
  check("A) alta sin pago → pendiente", s.suscripciones[0].estado, "pendiente");
  check("A) sin ingresos", await ingresosMes(), 0);

  // B) Alta "ya estaba pagado" (archivador) → al día SIN ingresos, y marcada como manual.
  const b = await POST("/socios", { nombre: "Berta", apellidos: "Archivador", fechaAlta: hoy });
  const phB = addMeses(hoy, 1);
  const subB = await POST(`/socios/${b.id}/suscripciones`, { actividad: "karate", importe: 35, pagadoHasta: phB });
  s = await GET(`/socios/${b.id}`);
  check("B) papel → al día", s.suscripciones[0].estado, "aldia");
  check("B) papel → marcado 'apuntado a mano'", s.suscripciones[0].coberturaSinCobro, true);
  check("B) papel NO genera ingresos", await ingresosMes(), 0);
  const metB = await GET(`/metricas?desde=${mes}&hasta=${mes}`);
  check("B) métricas avisan del socio con cobertura manual", metB.socios.coberturaManual, 1);

  // C) Alta "cobrar ahora" → pago real: ingresos, historial y cobertura de 1 mes.
  const c = await POST("/socios", { nombre: "Carlos", apellidos: "CobraYa", fechaAlta: hoy });
  await POST(`/socios/${c.id}/suscripciones`, { actividad: "pilates", importe: 40, cobroInicial: { metodo: "bizum" } });
  s = await GET(`/socios/${c.id}`);
  check("C) cobro inicial → al día", s.suscripciones[0].estado, "aldia");
  check("C) cobertura = hoy + 1 mes", s.suscripciones[0].pagadoHasta, addMeses(hoy, 1));
  check("C) NO es cobertura manual (hay pago detrás)", s.suscripciones[0].coberturaSinCobro, false);
  check("C) el cobro inicial cuenta en ingresos", await ingresosMes(), 40);
  const pagosC = await GET(`/pagos/de-socio/${c.id}`);
  check("C) hay 1 pago en el historial (con recibo posible)", pagosC.length, 1);
  check("C) método respetado", pagosC[0].metodo, "bizum");

  // D) Sin duplicidad: al socio del cobro inicial se le cobra el mes siguiente.
  await POST("/pagos", { socioId: c.id, lineas: [{ suscripcionId: s.suscripciones[0].id, importe: 40, meses: 1 }] });
  s = await GET(`/socios/${c.id}`);
  check("D) dos pagos reales = dos ingresos (sin duplicar)", await ingresosMes(), 80);
  check("D) cobertura encadena (+2 meses)", s.suscripciones[0].pagadoHasta, addMeses(hoy, 2));

  // E) Cobro sobre cobertura de papel: extiende desde ella y solo cuenta lo cobrado.
  const pagoE = await POST("/pagos", { socioId: b.id, lineas: [{ suscripcionId: subB.id, importe: 35, meses: 1 }] });
  s = await GET(`/socios/${b.id}`);
  check("E) ingresos = 80 + 35", await ingresosMes(), 115);
  check("E) extiende desde el papel", s.suscripciones[0].pagadoHasta, addMeses(phB, 1));
  check("E) ya no cuenta como 'a mano' (el pago va más allá)", s.suscripciones[0].coberturaSinCobro, false);

  // F) Borrar ese pago → vuelve la cobertura manual del alta (no "Sin pagar").
  await DEL(`/pagos/${pagoE.id}`);
  s = await GET(`/socios/${b.id}`);
  check("F) al borrar el pago vuelve la cobertura del papel", s.suscripciones[0].pagadoHasta, phB);
  check("F) y vuelve a marcarse como manual", s.suscripciones[0].coberturaSinCobro, true);
  check("F) ingresos descuentan el pago borrado", await ingresosMes(), 80);

  // G) Métricas y dashboard cuentan lo mismo.
  const met = await GET(`/metricas?desde=${mes}&hasta=${mes}`);
  check("G) métricas == dashboard", met.totales.ingresos, await ingresosMes());

  // H) La serie desglosa por actividad y la suma cuadra con el total del mes.
  const fila = met.serie[met.serie.length - 1];
  const sumaSegs = (Object.values(fila.porActividad) as number[]).reduce((a, b) => a + b, 0);
  check("H) desglose por actividad suma = ingresos del mes", sumaSegs, fila.ingresos);
  check("H) la proyección del mes en curso parte de lo cobrado", met.proyeccion.cobrado, fila.ingresos);
  check("H) sin mes anterior con pagos, la retención es null", fila.retencion, null);
  check("H) serieAnterior alinea mes a mes (misma longitud)", met.serieAnterior.length, met.serie.length);

  // I) Filtro por actividad: solo cuentan las líneas de esa actividad.
  const mPil = await GET(`/metricas?desde=${mes}&hasta=${mes}&actividad=pilates`);
  check("I) actividad=pilates → los dos pagos de pilates", mPil.totales.ingresos, 80);
  const mKar = await GET(`/metricas?desde=${mes}&hasta=${mes}&actividad=karate`);
  check("I) actividad=karate → 0 (su pago se borró)", mKar.totales.ingresos, 0);
  check("I) el reparto por actividad NO se filtra (enseña las 3)", mPil.porActividad.length > 0, true);

  // J) Bajas con fecha: dar de baja apunta el mes; reactivar lo limpia.
  await PUT(`/socios/${a.id}`, { estado: "baja" });
  let mB = await GET(`/metricas?desde=${mes}&hasta=${mes}`);
  check("J) la baja de hoy cuenta en el mes", mB.serie[mB.serie.length - 1].bajas, 1);
  await PUT(`/socios/${a.id}`, { estado: "activo" });
  mB = await GET(`/metricas?desde=${mes}&hasta=${mes}`);
  check("J) reactivar limpia la fecha de baja", mB.serie[mB.serie.length - 1].bajas, 0);

  // K) Historial de movimientos: cada operación deja su línea.
  const evC = (await GET(`/socios/${c.id}/eventos`)) as { tipo: string; detalle: string }[];
  const tiposC = evC.map((e) => e.tipo);
  check("K) alta del socio apuntada", tiposC.includes("alta"), true);
  check("K) el cobro inicial del alta queda como pago", evC.filter((e) => e.tipo === "pago").length, 2);
  const evB = (await GET(`/socios/${b.id}/eventos`)) as { tipo: string; detalle: string }[];
  check("K) el pago borrado deja constancia", evB.some((e) => e.tipo === "pago_borrado"), true);
  check("K) el alta 'ya estaba pagado' queda descrita", evB.some((e) => e.tipo === "actividad" && e.detalle.includes("ya estaba pagado")), true);
  const evA = (await GET(`/socios/${a.id}/eventos`)) as { tipo: string }[];
  check("K) baja y reactivación apuntadas", evA.some((e) => e.tipo === "baja") && evA.some((e) => e.tipo === "reactivado"), true);
}

main()
  .then(() => {
    console.log(fallos === 0 ? `✓ Ingresos: ${total} comprobaciones OK.` : `${fallos}/${total} comprobaciones fallan.`);
    process.exitCode = fallos === 0 ? 0 : 1;
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    servidor.kill();
    // Dar un instante a que suelte la BD antes de borrar la carpeta temporal.
    setTimeout(() => {
      try {
        rmSync(DATA, { recursive: true, force: true });
      } catch {
        /* carpeta temporal; el SO la limpiará */
      }
    }, 500).unref();
  });
