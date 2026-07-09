import { Router } from "express";
import { db } from "../db.ts";
import { addMeses, hoyISO } from "../util.ts";
import { registrarEvento } from "../eventos.ts";
import { suscripcionConEstado, type SuscripcionRow } from "../queries.ts";

const eur = (n: number) => `${(Math.round(n * 100) / 100).toString().replace(".", ",")} €`;
const ddmm = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");

export const suscripcionesRouter = Router();

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const METODOS = ["efectivo", "transferencia", "bizum", "tarjeta"];

// Alta de suscripcion para un socio. Tres arranques posibles:
//  - pendiente (sin nada): quedará "Sin pagar" hasta el primer cobro.
//  - pagadoHasta a mano: cuadra el estado (archivador en papel) SIN apuntar cobro
//    → se guarda también en cobertura_manual (no cuenta como ingreso, a propósito).
//  - cobroInicial {metodo, fecha?, meses?}: además de crear la actividad registra
//    el primer pago REAL (pagos + pago_lineas) en la misma transacción, para que
//    los ingresos del Panel/Métricas cuadren con el dinero cobrado de verdad.
suscripcionesRouter.post("/socios/:id/suscripciones", (req, res) => {
  const socio = db.prepare("SELECT id FROM socios WHERE id = ?").get(req.params.id);
  if (!socio) return res.status(404).json({ error: "Socio no encontrado" });
  const { actividad, etiqueta, importe, periodicidad, pagadoHasta, notas, cobroInicial } = req.body ?? {};
  if (!actividad || !String(actividad).trim()) return res.status(400).json({ error: "La actividad es obligatoria" });
  const imp = Number(importe);
  if (!Number.isFinite(imp) || imp < 0) return res.status(400).json({ error: "Importe no valido" });
  if (pagadoHasta && !ISO.test(String(pagadoHasta))) return res.status(400).json({ error: "Fecha 'pagado hasta' no válida" });

  const hoy = hoyISO();
  let cobro: { metodo: string; fecha: string; meses: number } | null = null;
  if (cobroInicial) {
    const fecha = cobroInicial.fecha || hoy;
    if (!ISO.test(String(fecha))) return res.status(400).json({ error: "Fecha del cobro no válida" });
    const meses = Math.min(Math.max(Number(cobroInicial.meses) || 1, 1), 120);
    const metodo = METODOS.includes(String(cobroInicial.metodo)) ? String(cobroInicial.metodo) : "efectivo";
    cobro = { metodo, fecha, meses };
  }

  const tx = db.transaction(() => {
    const ph = pagadoHasta || null;
    const info = db
      .prepare(
        `INSERT INTO suscripciones (socio_id, actividad, etiqueta, importe, periodicidad, pagado_hasta, cobertura_manual, activa, notas, creado_en)
         VALUES (?,?,?,?,?,?,?,1,?,?)`
      )
      .run(
        req.params.id,
        String(actividad).trim().toLowerCase(),
        etiqueta || null,
        imp,
        periodicidad === "bono" ? "bono" : "mensual",
        ph,
        ph, // lo puesto a mano en el alta es, por definición, cobertura sin cobro
        notas || null,
        hoy
      );
    const subId = info.lastInsertRowid as number;
    if (cobro) {
      // Igual que POST /pagos: el cobro extiende desde la cobertura vigente si la hay.
      const base = ph && ph > cobro.fecha ? ph : cobro.fecha;
      const hasta = addMeses(base, cobro.meses);
      const pago = db
        .prepare("INSERT INTO pagos (socio_id, fecha, metodo, total, notas, creado_en) VALUES (?,?,?,?,?,?)")
        .run(req.params.id, cobro.fecha, cobro.metodo, imp, null, hoy);
      db.prepare(
        `INSERT INTO pago_lineas (pago_id, suscripcion_id, actividad, concepto, importe, periodo_desde, periodo_hasta)
         VALUES (?,?,?,?,?,?,?)`
      ).run(pago.lastInsertRowid, subId, String(actividad).trim().toLowerCase(), etiqueta || null, imp, base, hasta);
      db.prepare("UPDATE suscripciones SET pagado_hasta = ? WHERE id = ?").run(hasta, subId);
    }
    return subId;
  });

  const s = db.prepare("SELECT * FROM suscripciones WHERE id = ?").get(tx()) as SuscripcionRow;
  const act = s.actividad;
  if (cobro) {
    registrarEvento(req.params.id, "pago", `Actividad ${act} añadida con su primer cobro: ${eur(imp)} en ${cobro.metodo} (cubre hasta ${ddmm(s.pagado_hasta)})`);
  } else if (s.cobertura_manual) {
    registrarEvento(req.params.id, "actividad", `Actividad ${act} añadida como «ya estaba pagado» hasta ${ddmm(s.cobertura_manual)} — fecha apuntada a mano, sin cobro registrado`);
  } else {
    registrarEvento(req.params.id, "actividad", `Actividad ${act} añadida, pendiente de su primer cobro (cuota de ${eur(imp)})`);
  }
  res.status(201).json(suscripcionConEstado(s, hoy));
});

// Editar suscripcion (importe, etiqueta, activa, periodicidad, pagado_hasta manual...).
suscripcionesRouter.put("/suscripciones/:id", (req, res) => {
  const s = db.prepare("SELECT * FROM suscripciones WHERE id = ?").get(req.params.id) as SuscripcionRow | undefined;
  if (!s) return res.status(404).json({ error: "Suscripcion no encontrada" });
  const { actividad, etiqueta, importe, periodicidad, pagadoHasta, activa, notas } = req.body ?? {};
  const imp = importe === undefined ? s.importe : Number(importe);
  if (!Number.isFinite(imp) || imp < 0) return res.status(400).json({ error: "Importe no valido" });
  if (pagadoHasta && !ISO.test(String(pagadoHasta))) return res.status(400).json({ error: "Fecha 'pagado hasta' no válida" });
  const nuevoPH = pagadoHasta === undefined ? s.pagado_hasta : pagadoHasta || null;
  // Si el usuario cambia "pagado hasta" a mano, esa nueva fecha pasa a ser la
  // cobertura manual (sin cobro que la respalde). Si no lo toca, se conserva.
  const coberturaManual = pagadoHasta !== undefined && nuevoPH !== s.pagado_hasta ? nuevoPH : s.cobertura_manual;
  db.prepare(
    `UPDATE suscripciones SET actividad=?, etiqueta=?, importe=?, periodicidad=?, pagado_hasta=?, cobertura_manual=?, activa=?, notas=? WHERE id=?`
  ).run(
    actividad ? String(actividad).trim().toLowerCase() : s.actividad,
    etiqueta ?? s.etiqueta,
    imp,
    periodicidad || s.periodicidad,
    nuevoPH,
    coberturaManual,
    activa === undefined ? s.activa : activa ? 1 : 0,
    notas ?? s.notas,
    s.id
  );
  const actualizada = db.prepare("SELECT * FROM suscripciones WHERE id = ?").get(s.id) as SuscripcionRow;
  // Historial: pausar/reactivar tiene su propia línea; el resto, solo lo que cambió.
  const activaAntes = !!s.activa;
  const activaAhora = !!actualizada.activa;
  if (activaAntes !== activaAhora) {
    registrarEvento(s.socio_id, "actividad", `Actividad ${actualizada.actividad} ${activaAhora ? "reactivada" : "pausada"}`);
  }
  const cambios: string[] = [];
  if (actualizada.importe !== s.importe) cambios.push(`cuota ${eur(s.importe)} → ${eur(actualizada.importe)}`);
  if (actualizada.pagado_hasta !== s.pagado_hasta)
    cambios.push(`pagado hasta ${ddmm(s.pagado_hasta)} → ${ddmm(actualizada.pagado_hasta)} (a mano, sin cobro)`);
  if (actualizada.actividad !== s.actividad) cambios.push(`actividad ${s.actividad} → ${actualizada.actividad}`);
  if (cambios.length) registrarEvento(s.socio_id, "actividad", `Actividad ${actualizada.actividad} editada: ${cambios.join(" · ")}`);
  res.json(suscripcionConEstado(actualizada, hoyISO()));
});

// Borrar suscripcion.
suscripcionesRouter.delete("/suscripciones/:id", (req, res) => {
  const s = db.prepare("SELECT * FROM suscripciones WHERE id = ?").get(req.params.id) as SuscripcionRow | undefined;
  const info = db.prepare("DELETE FROM suscripciones WHERE id = ?").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Suscripcion no encontrada" });
  if (s) registrarEvento(s.socio_id, "actividad", `Actividad ${s.actividad} quitada (cuota de ${eur(s.importe)}, cubría hasta ${ddmm(s.pagado_hasta)})`);
  res.json({ ok: true });
});
