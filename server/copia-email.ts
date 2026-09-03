import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { db, DATA_DIR } from "./db.ts";
import { emailConfigurado, leerConfigCopias } from "./config.ts";
import { enviarCorreo } from "./correo.ts";
import { ahoraISO } from "./eventos.ts";
import { ddmmaaaa } from "./texto.ts";

// Copia de seguridad FUERA del PC: la base de datos entera viaja adjunta por email
// al correo del gimnasio. Coste cero (Gmail), sin cuentas nuevas, y si el ordenador
// revienta basta con descargar el adjunto más reciente y restaurarlo (Copias →
// Restaurar) en la instalación nueva.
//
// Cuándo se envía (todo automático, ver index.ts):
//  - al CERRAR la app (cada día, cada vez que se apaga) → motivo "cierre";
//  - al ARRANCAR, si el último envío correcto no es de hoy (el cierre anterior pudo
//    ser brusco o sin internet) → "arranque";
//  - una vez al día si la app se queda abierta varios días → "diario";
//  - a mano desde Ajustes/Copias → "manual" (siempre envía, aunque no haya cambios).
// Si la base NO ha cambiado desde el último envío correcto no se reenvía lo mismo
// (salvo a mano): así no se llena el buzón con copias idénticas.

export type MotivoCopia = "cierre" | "arranque" | "diario" | "manual";

/** Estado de los envíos. Fuera de la BD a propósito (ver config.ts). */
export interface EstadoCopiaEmail {
  ultimoEnvio: string; // "YYYY-MM-DD HH:MM" del último envío correcto ("" si nunca)
  ultimoHash: string; // huella de la BD enviada la última vez (para no reenviar lo mismo)
  ultimoIntento: string; // "YYYY-MM-DD HH:MM" del último intento (correcto o no)
  ultimoError: string; // mensaje del último fallo ("" si el último intento fue bien)
  ultimoMotivo: string; // cierre | arranque | diario | manual
}
const ESTADO_PATH = resolve(DATA_DIR, "estado-copia-email.json");
const ESTADO_VACIO: EstadoCopiaEmail = { ultimoEnvio: "", ultimoHash: "", ultimoIntento: "", ultimoError: "", ultimoMotivo: "" };

export function leerEstadoCopiaEmail(): EstadoCopiaEmail {
  try {
    if (!existsSync(ESTADO_PATH)) return { ...ESTADO_VACIO };
    return { ...ESTADO_VACIO, ...JSON.parse(readFileSync(ESTADO_PATH, "utf8")) };
  } catch {
    return { ...ESTADO_VACIO };
  }
}

function guardarEstado(parcial: Partial<EstadoCopiaEmail>) {
  try {
    writeFileSync(ESTADO_PATH, JSON.stringify({ ...leerEstadoCopiaEmail(), ...parcial }, null, 2));
  } catch {
    /* el estado es informativo: nunca debe romper el envío */
  }
}

export interface ResultadoCopiaEmail {
  enviado: boolean;
  motivo: MotivoCopia;
  /** Por qué no se envió (si enviado = false). */
  porQueNo?: "desactivado" | "sin-destinatario" | "correo-no-configurado" | "sin-cambios" | "error";
  error?: string;
  para?: string;
  bytes?: number;
}

/** Imagen consistente de la BD (incluye lo que esté en el WAL) y su huella. */
function imagenBD(): { datos: Buffer; hash: string } {
  const datos = db.serialize();
  const hash = createHash("sha256").update(datos).digest("hex");
  return { datos, hash };
}

/** Fecha "YYYY-MM-DD" de un sello "YYYY-MM-DD HH:MM". */
export const diaDe = (sello: string) => sello.slice(0, 10);

/** ¿Hace falta enviar hoy? (no hay envío correcto con fecha de hoy). */
export function faltaEnvioDeHoy(): boolean {
  const c = leerConfigCopias();
  return c.activo && !!c.email && diaDe(leerEstadoCopiaEmail().ultimoEnvio) !== ahoraISO().slice(0, 10);
}

let enviando: Promise<ResultadoCopiaEmail> | null = null;

/**
 * Envía la copia por email. Serializada (si ya hay un envío en marcha, se espera a
 * ese y se devuelve su resultado). Nunca lanza: el resultado lo cuenta todo y
 * queda apuntado en la config (Ajustes/Copias lo enseñan).
 */
export function enviarCopiaPorEmail(motivo: MotivoCopia, opts: { forzar?: boolean } = {}): Promise<ResultadoCopiaEmail> {
  if (enviando) return enviando;
  enviando = enviarDeVerdad(motivo, opts).finally(() => {
    enviando = null;
  });
  return enviando;
}

async function enviarDeVerdad(motivo: MotivoCopia, opts: { forzar?: boolean }): Promise<ResultadoCopiaEmail> {
  const c = leerConfigCopias();
  const estado = leerEstadoCopiaEmail();
  const ahora = ahoraISO();
  if (!c.activo && !opts.forzar) return { enviado: false, motivo, porQueNo: "desactivado" };
  const para = c.email.trim();
  if (!para) return { enviado: false, motivo, porQueNo: "sin-destinatario" };
  if (!emailConfigurado()) {
    guardarEstado({ ultimoIntento: ahora, ultimoMotivo: motivo, ultimoError: "El correo no está configurado (Ajustes → Correo de envío)." });
    return { enviado: false, motivo, porQueNo: "correo-no-configurado", para };
  }

  const { datos, hash } = imagenBD();
  if (!opts.forzar && hash === estado.ultimoHash) return { enviado: false, motivo, porQueNo: "sin-cambios", para };

  const nSocios = (db.prepare("SELECT COUNT(*) AS n FROM socios").get() as { n: number }).n;
  const nPagos = (db.prepare("SELECT COUNT(*) AS n FROM pagos").get() as { n: number }).n;
  const sello = ahora.replace(" ", "_").replace(":", "-"); // 2026-09-03_19-40
  const archivo = `gymgrecia_${sello}.db`;
  const cuerpo =
    `Copia de seguridad de GymGrecia del ${ddmmaaaa(ahora.slice(0, 10))} a las ${ahora.slice(11)}.\n\n` +
    `Contiene ${nSocios} socios y ${nPagos} cobros (${Math.round(datos.length / 1024)} KB). Motivo: ${motivo}.\n\n` +
    `SI HAY QUE RECUPERAR LOS DATOS (el PC se ha roto o se ha cambiado):\n` +
    `  1. Instala GymGrecia en el ordenador nuevo (guía INSTALAR.md) y ábrela una vez.\n` +
    `  2. Descarga el adjunto de este correo (el más reciente que tengas).\n` +
    `  3. Cópialo dentro de la carpeta  data\\backups  de la instalación nueva.\n` +
    `  4. Abre GymGrecia → Copias → pulsa "Restaurar" en esa copia. Listo.\n\n` +
    `Este correo lo envía la propia aplicación cada día al cerrarse. No hace falta responder.`;

  try {
    await enviarCorreo(para, `Copia de seguridad GymGrecia · ${ddmmaaaa(ahora.slice(0, 10))} ${ahora.slice(11)}`, cuerpo, [
      { filename: archivo, content: datos },
    ]);
    guardarEstado({ ultimoEnvio: ahora, ultimoHash: hash, ultimoIntento: ahora, ultimoMotivo: motivo, ultimoError: "" });
    return { enviado: true, motivo, para, bytes: datos.length };
  } catch (e: any) {
    const error = String(e?.message ?? e);
    guardarEstado({ ultimoIntento: ahora, ultimoMotivo: motivo, ultimoError: error });
    return { enviado: false, motivo, porQueNo: "error", error, para };
  }
}

/** Con tope de tiempo (para el cierre: Windows mata el proceso a los ~10 s). */
export function enviarCopiaConTope(motivo: MotivoCopia, ms: number): Promise<ResultadoCopiaEmail> {
  return Promise.race([
    enviarCopiaPorEmail(motivo),
    new Promise<ResultadoCopiaEmail>((ok) => setTimeout(() => ok({ enviado: false, motivo, porQueNo: "error", error: "Sin tiempo al cerrar" }), ms).unref()),
  ]);
}
