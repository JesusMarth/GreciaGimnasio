import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { hoyISO } from "./util.ts";

// La base de datos vive en /data/gymgrecia.db (un solo archivo, facil de respaldar).
const dataDir = resolve(import.meta.dirname, "..", "data");
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
const dbPath = resolve(dataDir, "gymgrecia.db");

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS socios (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre           TEXT NOT NULL,
  telefono         TEXT,
  email            TEXT,
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

CREATE INDEX IF NOT EXISTS idx_suscripciones_socio ON suscripciones(socio_id);
CREATE INDEX IF NOT EXISTS idx_pagos_socio ON pagos(socio_id);
CREATE INDEX IF NOT EXISTS idx_lineas_pago ON pago_lineas(pago_id);
CREATE INDEX IF NOT EXISTS idx_lineas_suscripcion ON pago_lineas(suscripcion_id);
`);

// Tarifas de ejemplo la primera vez (editables/borrables; solo para no empezar en blanco).
const hayTarifas = db.prepare("SELECT COUNT(*) AS n FROM tarifas").get() as { n: number };
if (hayTarifas.n === 0) {
  const ahora = hoyISO();
  const ins = db.prepare(
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
  const tx = db.transaction(() => {
    for (const [nombre, actividad, importe, periodicidad] of ejemplos) {
      ins.run(nombre, actividad, importe, periodicidad, ahora);
    }
  });
  tx();
}
