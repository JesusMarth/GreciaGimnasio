import { Router } from "express";
import { db } from "../db.ts";
import { hoyISO, RANK_ESTADO } from "../util.ts";
import { suscripcionConEstado, type SuscripcionRow } from "../queries.ts";

export const dashboardRouter = Router();

dashboardRouter.get("/", (_req, res) => {
  const hoy = hoyISO();
  const mes = hoy.slice(0, 7);

  // Todas las suscripciones activas de socios activos, con datos del socio.
  const filas = db
    .prepare(
      `SELECT su.*,
              (so.nombre || CASE WHEN COALESCE(so.apellidos,'') <> '' THEN ' ' || so.apellidos ELSE '' END) AS socio_nombre,
              so.telefono AS socio_telefono, so.fecha_alta AS socio_alta
       FROM suscripciones su
       JOIN socios so ON so.id = su.socio_id
       WHERE su.activa = 1 AND so.estado = 'activo'`
    )
    .all() as (SuscripcionRow & { socio_nombre: string; socio_telefono: string | null; socio_alta: string })[];

  const items = filas.map((r) => {
    // El estado lo calcula el mismo sitio que la ficha (fecha o sesiones, según sea).
    const s = suscripcionConEstado(r, hoy);
    return {
      socioId: r.socio_id,
      socioNombre: r.socio_nombre,
      telefono: r.socio_telefono,
      suscripcionId: r.id,
      actividad: r.actividad,
      etiqueta: r.etiqueta,
      importe: r.importe,
      periodicidad: r.periodicidad,
      pagadoHasta: s.pagadoHasta,
      fechaAlta: r.socio_alta,
      estado: s.estado,
      dias: s.dias,
      esBono: s.esBono,
      sesionesRestantes: s.sesiones ? s.sesiones.restantes : null,
    };
  });

  // Urgencia numérica: días hasta vencer (negativo = atraso). En bonos por sesiones
  // se usan las sesiones que quedan (negativo = a deber), para que ordenen entre
  // las cuotas por fecha con el mismo criterio "cuanto menos, más urgente".
  const urgencia = (i: (typeof items)[number]) => i.dias ?? i.sesionesRestantes ?? 0;
  // El mas urgente primero (atrasado/pendiente con mas dias de retraso arriba).
  const ordenarUrgente = (a: (typeof items)[number], b: (typeof items)[number]) => {
    const ra = RANK_ESTADO[a.estado];
    const rb = RANK_ESTADO[b.estado];
    if (ra !== rb) return rb - ra;
    return urgencia(a) - urgencia(b);
  };

  const porCobrar = items.filter((i) => i.estado === "atrasado" || i.estado === "pendiente").sort(ordenarUrgente);
  const pronto = items.filter((i) => i.estado === "pronto").sort((a, b) => urgencia(a) - urgencia(b));
  const aldia = items.filter((i) => i.estado === "aldia").sort((a, b) => urgencia(a) - urgencia(b));

  // Ingresos del mes en curso.
  const totalMes =
    (db.prepare("SELECT COALESCE(SUM(total),0) AS t FROM pagos WHERE substr(fecha,1,7) = ?").get(mes) as any).t ?? 0;
  const porActividad = db
    .prepare(
      `SELECT l.actividad AS actividad, COALESCE(SUM(l.importe),0) AS total
       FROM pago_lineas l JOIN pagos p ON p.id = l.pago_id
       WHERE substr(p.fecha,1,7) = ? GROUP BY l.actividad ORDER BY total DESC`
    )
    .all(mes) as any[];
  const porMetodo = db
    .prepare(
      `SELECT metodo, COALESCE(SUM(total),0) AS total FROM pagos
       WHERE substr(fecha,1,7) = ? GROUP BY metodo ORDER BY total DESC`
    )
    .all(mes) as any[];

  const totalSocios = (db.prepare("SELECT COUNT(*) AS n FROM socios").get() as any).n;
  const totalActivos = (db.prepare("SELECT COUNT(*) AS n FROM socios WHERE estado = 'activo'").get() as any).n;

  res.json({
    hoy,
    resumen: {
      porCobrar: porCobrar.length,
      pronto: pronto.length,
      aldia: aldia.length,
      totalSocios,
      totalActivos,
    },
    ingresosMes: { total: totalMes, porActividad, porMetodo },
    porCobrar,
    pronto,
    aldia,
  });
});
