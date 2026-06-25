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

CREATE INDEX IF NOT EXISTS idx_suscripciones_socio ON suscripciones(socio_id);
CREATE INDEX IF NOT EXISTS idx_pagos_socio ON pagos(socio_id);
CREATE INDEX IF NOT EXISTS idx_lineas_pago ON pago_lineas(pago_id);
CREATE INDEX IF NOT EXISTS idx_lineas_suscripcion ON pago_lineas(suscripcion_id);
`);
  // Migración suave para BDs anteriores (CREATE TABLE IF NOT EXISTS no añade columnas nuevas).
  try {
    conn.exec("ALTER TABLE socios ADD COLUMN dni TEXT");
  } catch {
    /* la columna ya existe */
  }
  sembrarTarifas(conn);
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
