import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { resolve, basename } from "node:path";
import { db, BACKUPS_DIR } from "./db.ts";

// Cuántas copias automáticas conservar (se podan las más antiguas). Las manuales y
// las de "antes de restaurar" se conservan siempre.
const MAX_AUTO = 14;

// Cola que serializa las operaciones de mantenimiento (copias y restauración): nunca
// deben solaparse entre sí (dos backups a la vez, o un backup mientras se restaura).
let cola: Promise<unknown> = Promise.resolve();
export function enCola<T>(fn: () => Promise<T>): Promise<T> {
  const resultado = cola.then(fn, fn); // se ejecuta tras lo anterior, resuelva o falle
  cola = resultado.catch(() => {}); // la cola nunca se rompe por un fallo previo
  return resultado;
}

export type TipoCopia = "auto" | "manual" | "pre-restore";

export interface CopiaInfo {
  archivo: string;
  tipo: string;
  creado: string; // ISO
  bytes: number;
}

/** Sello de tiempo apto para nombre de fichero (sin ":", válido en Windows). */
function sello(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

function listarArchivos(): string[] {
  if (!existsSync(BACKUPS_DIR)) return [];
  return readdirSync(BACKUPS_DIR).filter((f) => f.startsWith("gymgrecia_") && f.endsWith(".db"));
}

function infoDe(archivo: string): CopiaInfo {
  const st = statSync(resolve(BACKUPS_DIR, archivo));
  return { archivo, tipo: archivo.split("_")[1] ?? "manual", creado: st.mtime.toISOString(), bytes: st.size };
}

/** Crea una copia consistente (backup en caliente de SQLite, válido con WAL). */
export async function crearCopia(tipo: TipoCopia): Promise<CopiaInfo> {
  if (!existsSync(BACKUPS_DIR)) mkdirSync(BACKUPS_DIR, { recursive: true });
  const archivo = `gymgrecia_${tipo}_${sello()}.db`;
  await db.backup(resolve(BACKUPS_DIR, archivo));
  if (tipo === "auto") podarAutomaticas();
  return infoDe(archivo);
}

function podarAutomaticas() {
  const autos = listarArchivos()
    .filter((a) => a.startsWith("gymgrecia_auto_"))
    .sort()
    .reverse(); // el sello ordena cronológicamente
  for (const viejo of autos.slice(MAX_AUTO)) {
    try {
      unlinkSync(resolve(BACKUPS_DIR, viejo));
    } catch {
      /* si está en uso, se podará la próxima vez */
    }
  }
}

/** Lista de copias, de la más reciente a la más antigua. */
export function listarCopias(): CopiaInfo[] {
  return listarArchivos()
    .map(infoDe)
    .sort((a, b) => (a.creado < b.creado ? 1 : -1));
}

/** Resuelve un nombre de copia a ruta absoluta, blindado contra path traversal. */
export function rutaDeCopia(archivo: string): string | null {
  const ruta = resolve(BACKUPS_DIR, basename(archivo)); // basename descarta cualquier "../"
  if (!ruta.startsWith(BACKUPS_DIR) || !existsSync(ruta)) return null;
  return ruta;
}
