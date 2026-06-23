import { Router } from "express";
import { db } from "../db.ts";
import { hoyISO } from "../util.ts";
import { suscripcionConEstado, type SuscripcionRow } from "../queries.ts";

export const suscripcionesRouter = Router();

// Alta de suscripcion para un socio.
suscripcionesRouter.post("/socios/:id/suscripciones", (req, res) => {
  const socio = db.prepare("SELECT id FROM socios WHERE id = ?").get(req.params.id);
  if (!socio) return res.status(404).json({ error: "Socio no encontrado" });
  const { actividad, etiqueta, importe, periodicidad, pagadoHasta, notas } = req.body ?? {};
  if (!actividad || !String(actividad).trim()) return res.status(400).json({ error: "La actividad es obligatoria" });
  const imp = Number(importe);
  if (!Number.isFinite(imp) || imp < 0) return res.status(400).json({ error: "Importe no valido" });
  const info = db
    .prepare(
      `INSERT INTO suscripciones (socio_id, actividad, etiqueta, importe, periodicidad, pagado_hasta, activa, notas, creado_en)
       VALUES (?,?,?,?,?,?,1,?,?)`
    )
    .run(
      req.params.id,
      String(actividad).trim().toLowerCase(),
      etiqueta || null,
      imp,
      periodicidad === "bono" ? "bono" : "mensual",
      pagadoHasta || null,
      notas || null,
      hoyISO()
    );
  const s = db.prepare("SELECT * FROM suscripciones WHERE id = ?").get(info.lastInsertRowid) as SuscripcionRow;
  res.status(201).json(suscripcionConEstado(s, hoyISO()));
});

// Editar suscripcion (importe, etiqueta, activa, periodicidad, pagado_hasta manual...).
suscripcionesRouter.put("/suscripciones/:id", (req, res) => {
  const s = db.prepare("SELECT * FROM suscripciones WHERE id = ?").get(req.params.id) as SuscripcionRow | undefined;
  if (!s) return res.status(404).json({ error: "Suscripcion no encontrada" });
  const { actividad, etiqueta, importe, periodicidad, pagadoHasta, activa, notas } = req.body ?? {};
  const imp = importe === undefined ? s.importe : Number(importe);
  if (!Number.isFinite(imp) || imp < 0) return res.status(400).json({ error: "Importe no valido" });
  db.prepare(
    `UPDATE suscripciones SET actividad=?, etiqueta=?, importe=?, periodicidad=?, pagado_hasta=?, activa=?, notas=? WHERE id=?`
  ).run(
    actividad ? String(actividad).trim().toLowerCase() : s.actividad,
    etiqueta ?? s.etiqueta,
    imp,
    periodicidad || s.periodicidad,
    pagadoHasta === undefined ? s.pagado_hasta : pagadoHasta || null,
    activa === undefined ? s.activa : activa ? 1 : 0,
    notas ?? s.notas,
    s.id
  );
  const actualizada = db.prepare("SELECT * FROM suscripciones WHERE id = ?").get(s.id) as SuscripcionRow;
  res.json(suscripcionConEstado(actualizada, hoyISO()));
});

// Borrar suscripcion.
suscripcionesRouter.delete("/suscripciones/:id", (req, res) => {
  const info = db.prepare("DELETE FROM suscripciones WHERE id = ?").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Suscripcion no encontrada" });
  res.json({ ok: true });
});
