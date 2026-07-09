import Database from "better-sqlite3";
import { existsSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { hoyISO } from "./util.ts";

// Todo el estado vive en un único archivo: /data/gymgrecia.db. Copiar la carpeta
// /data a otro equipo lleva TODOS los datos (incluidas las copias de /data/backups).
// Carpeta de datos. Por defecto "data"; GYM_DATA_DIR la cambia (p. ej. "data-mock"
// para el entorno de pruebas), sin tocar los datos reales.
export const DATA_DIR = resolve(import.meta.dirname, "..", process.env.GYM_DATA_DIR || "data");
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
export const DB_PATH = resolve(DATA_DIR, "gymgrecia.db");
export const BACKUPS_DIR = resolve(DATA_DIR, "backups");

// Conexión viva. Es `let` (no `const`) para poder reabrirla tras restaurar una copia:
// los módulos que importan `db` ven el cambio porque los imports de ESM son enlaces vivos.
export let db = new Database(DB_PATH);
aplicarConfig(db);

/** Pragmas + esquema (idempotente) + tarifas de ejemplo si la BD está vacía. */
function aplicarConfig(conn: Database.Database) {
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  // ¿Existía ya el historial de movimientos? (si no, tras crear el esquema se
  // reconstruye una sola vez a partir de lo que la BD conserva).
  const habiaEventos = !!conn.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='eventos'").get();
  conn.exec(`
CREATE TABLE IF NOT EXISTS socios (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre           TEXT NOT NULL,
  telefono         TEXT,
  email            TEXT,
  dni              TEXT,
  fecha_alta       TEXT NOT NULL,
  fecha_nacimiento TEXT,
  estado           TEXT NOT NULL DEFAULT 'activo',   -- activo | baja
  notas            TEXT,
  creado_en        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS suscripciones (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  socio_id      INTEGER NOT NULL REFERENCES socios(id) ON DELETE CASCADE,
  actividad     TEXT NOT NULL,                        -- gimnasio | karate | pilates | ...
  etiqueta      TEXT,                                 -- ej. "Karate juvenil"
  importe       REAL NOT NULL,                        -- importe acordado por periodo
  periodicidad  TEXT NOT NULL DEFAULT 'mensual',      -- mensual | bono
  pagado_hasta  TEXT,                                 -- fecha de cobertura; null = sin pagos aun
  activa        INTEGER NOT NULL DEFAULT 1,
  notas         TEXT,
  creado_en     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pagos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  socio_id   INTEGER NOT NULL REFERENCES socios(id) ON DELETE CASCADE,
  fecha      TEXT NOT NULL,
  metodo     TEXT NOT NULL DEFAULT 'efectivo',        -- efectivo | transferencia | bizum | tarjeta
  total      REAL NOT NULL,
  notas      TEXT,
  creado_en  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pago_lineas (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  pago_id        INTEGER NOT NULL REFERENCES pagos(id) ON DELETE CASCADE,
  suscripcion_id INTEGER REFERENCES suscripciones(id) ON DELETE SET NULL,
  actividad      TEXT NOT NULL,                        -- copia para informes aunque se borre la suscripcion
  concepto       TEXT,
  importe        REAL NOT NULL,
  periodo_desde  TEXT,
  periodo_hasta  TEXT
);

CREATE TABLE IF NOT EXISTS tarifas (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre        TEXT NOT NULL,
  actividad     TEXT NOT NULL,
  importe       REAL NOT NULL,
  periodicidad  TEXT NOT NULL DEFAULT 'mensual',
  creado_en     TEXT NOT NULL
);

-- Ajustes de la app (clave/valor). P. ej. la configuración de correo (email.*).
CREATE TABLE IF NOT EXISTS config (
  clave TEXT PRIMARY KEY,
  valor TEXT
);

-- Historial de movimientos por socio (cobros, borrados, altas, bajas, avisos…).
-- socio_nombre es copia: si el socio se borra, el evento sobrevive (socio_id NULL).
CREATE TABLE IF NOT EXISTS eventos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  socio_id     INTEGER REFERENCES socios(id) ON DELETE SET NULL,
  socio_nombre TEXT,
  fecha        TEXT NOT NULL,                       -- "YYYY-MM-DD HH:MM" (o solo fecha si es reconstruido)
  tipo         TEXT NOT NULL,                       -- alta | baja | reactivado | ficha | actividad | pago | pago_borrado | recibo | aviso | borrado
  detalle      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_eventos_socio ON eventos(socio_id);
CREATE INDEX IF NOT EXISTS idx_suscripciones_socio ON suscripciones(socio_id);
CREATE INDEX IF NOT EXISTS idx_pagos_socio ON pagos(socio_id);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha ON pagos(fecha);
CREATE INDEX IF NOT EXISTS idx_lineas_pago ON pago_lineas(pago_id);
CREATE INDEX IF NOT EXISTS idx_lineas_suscripcion ON pago_lineas(suscripcion_id);
`);
  // Migración suave para BDs anteriores (CREATE TABLE IF NOT EXISTS no añade columnas nuevas).
  // Los socios ya existentes quedan con la columna a NULL; se rellena al editarlos.
  try {
    conn.exec("ALTER TABLE socios ADD COLUMN dni TEXT");
  } catch {
    /* la columna ya existe */
  }
  try {
    conn.exec("ALTER TABLE socios ADD COLUMN sexo TEXT"); // hombre | mujer | null
  } catch {
    /* la columna ya existe */
  }
  try {
    // Fecha en que el socio se dio de baja (para "bajas por mes" en Métricas).
    // Se apunta al pasar a baja y se limpia al reactivar. Las bajas anteriores a
    // esta versión no tienen fecha y no salen en la gráfica (no se inventa).
    conn.exec("ALTER TABLE socios ADD COLUMN fecha_baja TEXT");
  } catch {
    /* la columna ya existe */
  }
  try {
    // Cobertura "apuntada a mano" (campo Pagado hasta del alta/edición, típico del
    // archivador en papel): NO respaldada por un pago registrado. Se guarda aparte
    // para (1) poder restaurarla si se borra un pago posterior y (2) poder señalar
    // en Métricas/ficha que ese dinero no está en Ingresos.
    conn.exec("ALTER TABLE suscripciones ADD COLUMN cobertura_manual TEXT");
    // Solo esta vez: en BDs anteriores, la cobertura que va más allá de lo que
    // justifican las líneas de pago solo pudo ponerse a mano.
    conn.exec(`UPDATE suscripciones SET cobertura_manual = pagado_hasta
      WHERE pagado_hasta IS NOT NULL
        AND pagado_hasta > COALESCE((SELECT MAX(l.periodo_hasta) FROM pago_lineas l WHERE l.suscripcion_id = suscripciones.id), '')`);
  } catch {
    /* la columna ya existe */
  }
  try {
    conn.exec("ALTER TABLE socios ADD COLUMN apellidos TEXT");
    // Recién añadida: repartimos el "nombre completo" histórico en nombre (pila) +
    // apellidos, partiendo por el PRIMER espacio ("María García López" → "María" /
    // "García López"). Es best-effort (los nombres compuestos quedan en 'nombre');
    // el dueño puede afinarlo editando la ficha. Solo corre esta vez.
    const filas = conn.prepare("SELECT id, nombre FROM socios").all() as { id: number; nombre: string }[];
    const upd = conn.prepare("UPDATE socios SET nombre = ?, apellidos = ? WHERE id = ?");
    const tx = conn.transaction(() => {
      for (const f of filas) {
        const partes = String(f.nombre).trim().split(/\s+/);
        const pila = partes.shift() || f.nombre;
        const apellidos = partes.join(" ");
        upd.run(pila, apellidos || null, f.id);
      }
    });
    tx();
  } catch {
    /* la columna ya existe */
  }
  sembrarTarifas(conn);
  if (!habiaEventos) reconstruirEventos(conn);
}

/**
 * Reconstruye el historial de movimientos a partir de lo que la BD conserva:
 * altas, actividades apuntadas, pagos y bajas con fecha. Solo para socios que aún
 * no tienen ningún evento (corre una vez al estrenar la tabla, y la usa el seed
 * del mock). Lo borrado antes de existir el historial no se puede recuperar; esas
 * líneas van marcadas como "(reconstruido)" y llevan fecha pero no hora.
 */
export function reconstruirEventos(conn: Database.Database = db) {
  const ins = conn.prepare("INSERT INTO eventos (socio_id, socio_nombre, fecha, tipo, detalle) VALUES (?,?,?,?,?)");
  const socios = conn
    .prepare(
      `SELECT s.id, s.nombre || CASE WHEN COALESCE(s.apellidos,'') <> '' THEN ' ' || s.apellidos ELSE '' END AS nombre,
              s.fecha_alta, s.fecha_baja, s.estado
       FROM socios s WHERE NOT EXISTS (SELECT 1 FROM eventos e WHERE e.socio_id = s.id)`
    )
    .all() as { id: number; nombre: string; fecha_alta: string; fecha_baja: string | null; estado: string }[];
  const subsDe = conn.prepare("SELECT actividad, importe, creado_en FROM suscripciones WHERE socio_id = ?");
  const pagosDe = conn.prepare("SELECT fecha, metodo, total FROM pagos WHERE socio_id = ? ORDER BY fecha, id");
  const eur = (n: number) => `${(Math.round(n * 100) / 100).toString().replace(".", ",")} €`;
  const tx = conn.transaction(() => {
    for (const s of socios) {
      ins.run(s.id, s.nombre, s.fecha_alta, "alta", "Alta del socio (reconstruido del historial)");
      for (const su of subsDe.all(s.id) as { actividad: string; importe: number; creado_en: string }[]) {
        ins.run(s.id, s.nombre, su.creado_en, "actividad", `Actividad ${su.actividad} apuntada, cuota de ${eur(su.importe)} (reconstruido)`);
      }
      for (const p of pagosDe.all(s.id) as { fecha: string; metodo: string; total: number }[]) {
        ins.run(s.id, s.nombre, p.fecha, "pago", `Cobro de ${eur(p.total)} en ${p.metodo} (reconstruido)`);
      }
      if (s.estado === "baja" && s.fecha_baja) ins.run(s.id, s.nombre, s.fecha_baja, "baja", "Baja del socio (reconstruido)");
    }
  });
  tx();
}

// Tarifas de ejemplo la primera vez (editables/borrables; solo para no empezar en blanco).
function sembrarTarifas(conn: Database.Database) {
  const hay = conn.prepare("SELECT COUNT(*) AS n FROM tarifas").get() as { n: number };
  if (hay.n > 0) return;
  const ahora = hoyISO();
  const ins = conn.prepare(
    "INSERT INTO tarifas (nombre, actividad, importe, periodicidad, creado_en) VALUES (?,?,?,?,?)"
  );
  const ejemplos: [string, string, number, string][] = [
    ["Gimnasio mensual", "gimnasio", 35, "mensual"],
    ["Gimnasio familiar", "gimnasio", 30, "mensual"],
    ["Karate adulto", "karate", 35, "mensual"],
    ["Karate juvenil", "karate", 32, "mensual"],
    ["Karate infantil", "karate", 27, "mensual"],
    ["Pilates mensual", "pilates", 35, "mensual"],
    ["Pilates + gimnasio", "pilates", 45, "mensual"],
  ];
  const tx = conn.transaction(() => {
    for (const [nombre, actividad, importe, periodicidad] of ejemplos) {
      ins.run(nombre, actividad, importe, periodicidad, ahora);
    }
  });
  tx();
}

/**
 * Reemplaza la base de datos viva por la de una copia y reabre la conexión.
 * Valida primero que la copia es una BD SQLite legible; si esa validación falla,
 * no se toca nada. Tras reabrir, `db` (enlace vivo) apunta a los datos restaurados.
 */
export async function restaurarBaseDeDatos(rutaCopia: string) {
  // 1) Validar que la copia es una BD SQLite legible (antes de tocar lo actual).
  const prueba = new Database(rutaCopia, { readonly: true });
  try {
    prueba.prepare("SELECT count(*) FROM sqlite_master").get();
  } finally {
    prueba.close();
  }
  // 2) Consolidar el WAL y cerrar la conexión viva.
  try {
    db.pragma("wal_checkpoint(TRUNCATE)");
  } catch {
    /* si no se puede hacer checkpoint, continuamos */
  }
  db.close();
  try {
    // Limpiar los sidecar de WAL antes de pisar el fichero principal.
    for (const ext of ["-wal", "-shm"]) {
      const f = DB_PATH + ext;
      if (existsSync(f)) rmSync(f);
    }
    copyFileSync(rutaCopia, DB_PATH);
  } finally {
    // Pase lo que pase (incluido un fallo al copiar por un lock en Windows), reabrimos:
    // si no, la app quedaría con la conexión cerrada y muerta hasta reiniciar.
    db = new Database(DB_PATH);
    aplicarConfig(db);
  }
}
