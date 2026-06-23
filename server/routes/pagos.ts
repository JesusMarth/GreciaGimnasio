import { Router } from "express";
import { db } from "../db.ts";
import { addMeses, hoyISO } from "../util.ts";
import type { SuscripcionRow } from "../queries.ts";

export const pagosRouter = Router();

interface LineaEntrada {
  suscripcionId?: number | null;
  actividad?: string;
  concepto?: string;
  importe: number;
  meses?: number;
  periodoDesde?: string;
  periodoHasta?: string;
}

// Registrar un pago. Puede llevar varias lineas (una por actividad) en un solo cobro.
// Cada linea avanza el "pagado_hasta" de su suscripcion. Todo en una transaccion.
pagosRouter.post("/", (req, res) => {
  const { socioId, fecha, metodo, notas, lineas } = req.body ?? {};
  if (!socioId) return res.status(400).json({ error: "Falta el socio" });
  const socio = db.prepare("SELECT id FROM socios WHERE id = ?").get(socioId);
  if (!socio) return res.status(404).json({ error: "Socio no encontrado" });
  if (!Array.isArray(lineas) || lineas.length === 0)
    return res.status(400).json({ error: "El pago necesita al menos una linea" });

  const fechaPago = fecha || hoyISO();

  // Normalizar lineas y resolver la suscripcion de cada una.
  const preparadas = (lineas as LineaEntrada[]).map((l) => {
    const importe = Number(l.importe);
    if (!Number.isFinite(importe) || importe < 0) throw { code: 400, msg: "Importe de linea no valido" };
    let actividad = l.actividad ? String(l.actividad).toLowerCase() : "otros";
    let concepto = l.concepto ?? null;
    let desde = l.periodoDesde ?? null;
    let hasta = l.periodoHasta ?? null;
    let sub: SuscripcionRow | undefined;
    if (l.suscripcionId) {
      sub = db.prepare("SELECT * FROM suscripciones WHERE id = ?").get(l.suscripcionId) as SuscripcionRow | undefined;
      if (!sub) throw { code: 404, msg: "Suscripcion de la linea no encontrada" };
      actividad = sub.actividad;
      if (!concepto) concepto = sub.etiqueta;
      // Por defecto: extiende desde la cobertura vigente; si caduco, desde la fecha del pago.
      const base = sub.pagado_hasta && sub.pagado_hasta > fechaPago ? sub.pagado_hasta : fechaPago;
      if (!desde) desde = base;
      if (!hasta) hasta = addMeses(base, l.meses && l.meses > 0 ? l.meses : 1);
    }
    return { suscripcionId: l.suscripcionId ?? null, actividad, concepto, importe, desde, hasta, sub };
  });

  const total = preparadas.reduce((acc, l) => acc + l.importe, 0);
  const ahora = hoyISO();

  const tx = db.transaction(() => {
    const pago = db
      .prepare("INSERT INTO pagos (socio_id, fecha, metodo, total, notas, creado_en) VALUES (?,?,?,?,?,?)")
      .run(socioId, fechaPago, metodo || "efectivo", total, notas || null, ahora);
    const insLinea = db.prepare(
      `INSERT INTO pago_lineas (pago_id, suscripcion_id, actividad, concepto, importe, periodo_desde, periodo_hasta)
       VALUES (?,?,?,?,?,?,?)`
    );
    const updSub = db.prepare("UPDATE suscripciones SET pagado_hasta = ? WHERE id = ?");
    for (const l of preparadas) {
      insLinea.run(pago.lastInsertRowid, l.suscripcionId, l.actividad, l.concepto, l.importe, l.desde, l.hasta);
      // Solo adelantamos la cobertura si la nueva fecha es posterior a la que ya tenia.
      if (l.suscripcionId && l.hasta && l.sub && (!l.sub.pagado_hasta || l.hasta > l.sub.pagado_hasta)) {
        updSub.run(l.hasta, l.suscripcionId);
      }
    }
    return pago.lastInsertRowid;
  });

  try {
    const id = tx();
    res.status(201).json({ id, total });
  } catch (e: any) {
    if (e && e.code && e.msg) return res.status(e.code).json({ error: e.msg });
    throw e;
  }
});

// Historial de pagos de un socio (con sus lineas).
pagosRouter.get("/de-socio/:id", (req, res) => {
  const pagos = db
    .prepare("SELECT * FROM pagos WHERE socio_id = ? ORDER BY fecha DESC, id DESC")
    .all(req.params.id) as any[];
  const lineasStmt = db.prepare("SELECT * FROM pago_lineas WHERE pago_id = ?");
  res.json(
    pagos.map((p) => ({
      id: p.id,
      fecha: p.fecha,
      metodo: p.metodo,
      total: p.total,
      notas: p.notas,
      lineas: (lineasStmt.all(p.id) as any[]).map((l) => ({
        actividad: l.actividad,
        concepto: l.concepto,
        importe: l.importe,
        periodoDesde: l.periodo_desde,
        periodoHasta: l.periodo_hasta,
      })),
    }))
  );
});

// Borrar un pago y recalcular la cobertura de las suscripciones afectadas.
pagosRouter.delete("/:id", (req, res) => {
  const lineas = db.prepare("SELECT DISTINCT suscripcion_id FROM pago_lineas WHERE pago_id = ?").all(req.params.id) as {
    suscripcion_id: number | null;
  }[];
  const info = db.prepare("DELETE FROM pagos WHERE id = ?").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Pago no encontrado" });
  // Recalcular pagado_hasta = ultima cobertura que quede de cada suscripcion (o null).
  const maxStmt = db.prepare("SELECT MAX(periodo_hasta) AS m FROM pago_lineas WHERE suscripcion_id = ?");
  const updStmt = db.prepare("UPDATE suscripciones SET pagado_hasta = ? WHERE id = ?");
  for (const { suscripcion_id } of lineas) {
    if (!suscripcion_id) continue;
    const r = maxStmt.get(suscripcion_id) as { m: string | null };
    updStmt.run(r.m ?? null, suscripcion_id);
  }
  res.json({ ok: true });
});
