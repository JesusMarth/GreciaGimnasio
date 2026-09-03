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
  const { nombre, actividad, importe, periodicidad, sesiones } = req.body ?? {};
  if (!nombre || !actividad) return res.status(400).json({ error: "Nombre y actividad obligatorios" });
  const imp = Number(importe);
  if (!Number.isFinite(imp) || imp < 0) return res.status(400).json({ error: "Importe no valido" });
  const esBono = periodicidad === "bono";
  const ses = esBono ? Math.round(Number(sesiones)) || null : null; // sesiones por bono (solo bonos)
  if (esBono && (!ses || ses < 1)) return res.status(400).json({ error: "Indica cuántas sesiones trae el bono (p. ej. 20)" });
  const info = db
    .prepare("INSERT INTO tarifas (nombre, actividad, importe, periodicidad, sesiones, creado_en) VALUES (?,?,?,?,?,?)")
    .run(String(nombre).trim(), String(actividad).trim().toLowerCase(), imp, esBono ? "bono" : "mensual", ses, hoyISO());
  res.status(201).json(db.prepare("SELECT * FROM tarifas WHERE id = ?").get(info.lastInsertRowid));
});

tarifasRouter.put("/:id", (req, res) => {
  const t = db.prepare("SELECT * FROM tarifas WHERE id = ?").get(req.params.id) as any;
  if (!t) return res.status(404).json({ error: "Tarifa no encontrada" });
  const { nombre, actividad, importe, periodicidad, sesiones } = req.body ?? {};
  const imp = importe === undefined ? t.importe : Number(importe);
  if (!Number.isFinite(imp) || imp < 0) return res.status(400).json({ error: "Importe no valido" });
  const per = periodicidad || t.periodicidad;
  const ses = per === "bono" ? (sesiones === undefined ? t.sesiones : Math.round(Number(sesiones)) || null) : null;
  if (per === "bono" && (!ses || ses < 1)) return res.status(400).json({ error: "Indica cuántas sesiones trae el bono (p. ej. 20)" });
  db.prepare("UPDATE tarifas SET nombre=?, actividad=?, importe=?, periodicidad=?, sesiones=? WHERE id=?").run(
    nombre?.trim() || t.nombre,
    actividad ? String(actividad).trim().toLowerCase() : t.actividad,
    imp,
    per,
    ses,
    t.id
  );
  res.json(db.prepare("SELECT * FROM tarifas WHERE id = ?").get(t.id));
});

tarifasRouter.delete("/:id", (req, res) => {
  const info = db.prepare("DELETE FROM tarifas WHERE id = ?").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Tarifa no encontrada" });
  res.json({ ok: true });
});
