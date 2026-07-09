import { Router } from "express";
import { db } from "../db.ts";
import { addMeses, hoyISO } from "../util.ts";
import type { SuscripcionRow } from "../queries.ts";
import { generarReciboPDF, datosDelRecibo, eur, ddmmaaaa } from "../recibo.ts";
import { enviarCorreo } from "../correo.ts";
import { emailConfigurado, leerConfigEmail, leerDatosRecibo } from "../config.ts";
import { registrarEvento } from "../eventos.ts";

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

  // Validar fechas: una fecha no-ISO corrompe el estado de cuota y el agrupado del
  // dashboard, y se colaría en la cabecera del recibo. Rechazamos de entrada.
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  if (fecha != null && fecha !== "" && !ISO.test(String(fecha)))
    return res.status(400).json({ error: "Fecha no válida" });
  for (const l of lineas as LineaEntrada[]) {
    if (l.periodoDesde != null && l.periodoDesde !== "" && !ISO.test(String(l.periodoDesde)))
      return res.status(400).json({ error: "Periodo (desde) no válido" });
    if (l.periodoHasta != null && l.periodoHasta !== "" && !ISO.test(String(l.periodoHasta)))
      return res.status(400).json({ error: "Periodo (hasta) no válido" });
  }
  const metodoOk = ["efectivo", "transferencia", "bizum", "tarjeta"].includes(String(metodo)) ? String(metodo) : "efectivo";

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
      if (!hasta) hasta = addMeses(base, l.meses && l.meses > 0 ? Math.min(l.meses, 120) : 1);
    }
    return { suscripcionId: l.suscripcionId ?? null, actividad, concepto, importe, desde, hasta, sub };
  });

  const total = preparadas.reduce((acc, l) => acc + l.importe, 0);
  const ahora = hoyISO();

  const tx = db.transaction(() => {
    const pago = db
      .prepare("INSERT INTO pagos (socio_id, fecha, metodo, total, notas, creado_en) VALUES (?,?,?,?,?,?)")
      .run(socioId, fechaPago, metodoOk, total, notas || null, ahora);
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
    registrarEvento(
      socioId,
      "pago",
      `Cobro de ${eur(total)} en ${metodoOk} (${fechaPago === hoyISO() ? "hoy" : "con fecha " + ddmmaaaa(fechaPago)}): ` +
        preparadas.map((l) => `${l.actividad} ${eur(l.importe)}${l.hasta ? ` hasta ${ddmmaaaa(l.hasta)}` : ""}`).join(" · ")
    );
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

// Borrar un pago y recalcular la cobertura de las suscripciones afectadas (atómico).
pagosRouter.delete("/:id", (req, res) => {
  const id = req.params.id;
  // Datos del pago ANTES de borrarlo, para dejar constancia en el historial.
  const pago = db.prepare("SELECT socio_id, fecha, metodo, total FROM pagos WHERE id = ?").get(id) as
    | { socio_id: number; fecha: string; metodo: string; total: number }
    | undefined;
  const subs = db.prepare("SELECT DISTINCT suscripcion_id FROM pago_lineas WHERE pago_id = ?").all(id) as {
    suscripcion_id: number | null;
  }[];
  const tx = db.transaction(() => {
    const info = db.prepare("DELETE FROM pagos WHERE id = ?").run(id);
    if (info.changes === 0) return 0;
    // Recalcular pagado_hasta = lo ultimo que quede cubierto: la mayor cobertura de
    // las lineas de pago restantes o, si va mas alla, la cobertura manual del alta
    // (sin ella, borrar un pago dejaria al socio "Sin pagar" aunque viniera pagado
    // del archivador en papel).
    const maxStmt = db.prepare("SELECT MAX(periodo_hasta) AS m FROM pago_lineas WHERE suscripcion_id = ?");
    const manualStmt = db.prepare("SELECT cobertura_manual AS cm FROM suscripciones WHERE id = ?");
    const updStmt = db.prepare("UPDATE suscripciones SET pagado_hasta = ? WHERE id = ?");
    for (const { suscripcion_id } of subs) {
      if (!suscripcion_id) continue;
      const r = maxStmt.get(suscripcion_id) as { m: string | null };
      const cm = (manualStmt.get(suscripcion_id) as { cm: string | null } | undefined)?.cm ?? null;
      const candidatas = [r.m, cm].filter((x): x is string => !!x);
      updStmt.run(candidatas.length ? candidatas.reduce((a, b) => (a > b ? a : b)) : null, suscripcion_id);
    }
    return info.changes;
  });
  if (tx() === 0) return res.status(404).json({ error: "Pago no encontrado" });
  if (pago)
    registrarEvento(
      pago.socio_id,
      "pago_borrado",
      `Se borró el pago de ${eur(pago.total)} del ${ddmmaaaa(pago.fecha)} (${pago.metodo}); la cobertura de sus cuotas se recalculó`
    );
  res.json({ ok: true });
});

// --- Recibo en PDF ----------------------------------------------------------

// Ver / descargar el recibo de un pago. ?dl=1 fuerza la descarga.
pagosRouter.get("/:id/recibo.pdf", async (req, res) => {
  const datos = datosDelRecibo(Number(req.params.id));
  if (!datos) return res.status(404).json({ error: "Pago no encontrado" });
  try {
    const pdf = await generarReciboPDF(Number(req.params.id));
    const disp = req.query.dl ? "attachment" : "inline";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${disp}; filename="${datos.numero}.pdf"`);
    res.send(pdf);
  } catch (e: any) {
    res.status(500).json({ error: "No se pudo generar el recibo: " + (e?.message ?? e) });
  }
});

// Enviar el recibo en PDF al email del socio (adjunto).
pagosRouter.post("/:id/recibo/email", async (req, res) => {
  const datos = datosDelRecibo(Number(req.params.id));
  if (!datos) return res.status(404).json({ error: "Pago no encontrado" });
  if (!datos.socio.email) return res.status(400).json({ error: `${datos.socio.nombre} no tiene email guardado.` });
  if (!emailConfigurado()) return res.status(400).json({ error: "Configura primero el correo en Ajustes." });
  try {
    const pdf = await generarReciboPDF(Number(req.params.id));
    const f = leerDatosRecibo();
    const firma = f.nombre || leerConfigEmail().remitente || "El gimnasio";
    const doc = (f.tipoDoc || "Recibo").toLowerCase();
    await enviarCorreo(
      datos.socio.email,
      `${f.tipoDoc || "Recibo"} ${datos.numero} · ${firma}`,
      `Hola ${datos.socio.nombre}:\n\nAdjuntamos tu ${doc} ${datos.numero} por el pago de ${eur(datos.pago.total)} del ${ddmmaaaa(
        datos.pago.fecha
      )}.\n\nUn saludo,\n${firma}`,
      [{ filename: `${datos.numero}.pdf`, content: pdf }]
    );
    const p = db.prepare("SELECT socio_id FROM pagos WHERE id = ?").get(req.params.id) as { socio_id: number } | undefined;
    if (p) registrarEvento(p.socio_id, "recibo", `${f.tipoDoc || "Recibo"} ${datos.numero} enviado por email a ${datos.socio.email}`);
    res.json({ ok: true, email: datos.socio.email });
  } catch (e: any) {
    res.status(500).json({ error: "No se pudo enviar: " + (e?.message ?? e) });
  }
});
