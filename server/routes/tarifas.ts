import { Router } from "express";
import { db } from "../db.ts";
import { hoyISO } from "../util.ts";

export const tarifasRouter = Router();

// Las tarifas son solo plantillas para no reescribir importes; el precio real
// se fija en cada suscripcion. La app es agnostica a ofertas/descuentos.
tarifasRouter.get("/", (_req, res) => {
  res.json(db.prepare("SELECT * FROM tarifas ORDER BY actividad, nombre").all());
});

tarifasRouter.post("/", (req, res) => {
  const { nombre, actividad, importe, periodicidad } = req.body ?? {};
  if (!nombre || !actividad) return res.status(400).json({ error: "Nombre y actividad obligatorios" });
  const imp = Number(importe);
  if (!Number.isFinite(imp) || imp < 0) return res.status(400).json({ error: "Importe no valido" });
  const info = db
    .prepare("INSERT INTO tarifas (nombre, actividad, importe, periodicidad, creado_en) VALUES (?,?,?,?,?)")
    .run(String(nombre).trim(), String(actividad).trim().toLowerCase(), imp, periodicidad === "bono" ? "bono" : "mensual", hoyISO());
  res.status(201).json(db.prepare("SELECT * FROM tarifas WHERE id = ?").get(info.lastInsertRowid));
});

tarifasRouter.put("/:id", (req, res) => {
  const t = db.prepare("SELECT * FROM tarifas WHERE id = ?").get(req.params.id) as any;
  if (!t) return res.status(404).json({ error: "Tarifa no encontrada" });
  const { nombre, actividad, importe, periodicidad } = req.body ?? {};
  const imp = importe === undefined ? t.importe : Number(importe);
  if (!Number.isFinite(imp) || imp < 0) return res.status(400).json({ error: "Importe no valido" });
  db.prepare("UPDATE tarifas SET nombre=?, actividad=?, importe=?, periodicidad=? WHERE id=?").run(
    nombre?.trim() || t.nombre,
    actividad ? String(actividad).trim().toLowerCase() : t.actividad,
    imp,
    periodicidad || t.periodicidad,
    t.id
  );
  res.json(db.prepare("SELECT * FROM tarifas WHERE id = ?").get(t.id));
});

tarifasRouter.delete("/:id", (req, res) => {
  const info = db.prepare("DELETE FROM tarifas WHERE id = ?").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Tarifa no encontrada" });
  res.json({ ok: true });
});
