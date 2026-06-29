import { Router } from "express";
import { db } from "../db.ts";
import { estadoDe, hoyISO, RANK_ESTADO } from "../util.ts";

export const dashboardRouter = Router();

dashboardRouter.get("/", (_req, res) => {
  const hoy = hoyISO();
  const mes = hoy.slice(0, 7);

  // Todas las suscripciones activas de socios activos, con datos del socio.
  const filas = db
    .prepare(
      `SELECT su.id, su.actividad, su.etiqueta, su.importe, su.periodicidad, su.pagado_hasta,
              so.id AS socio_id, so.nombre AS socio_nombre, so.telefono AS socio_telefono, so.fecha_alta AS socio_alta
       FROM suscripciones su
       JOIN socios so ON so.id = su.socio_id
       WHERE su.activa = 1 AND so.estado = 'activo'`
    )
    .all() as any[];

  const items = filas.map((r) => {
    const { estado, dias } = estadoDe(r.pagado_hasta, hoy);
    return {
      socioId: r.socio_id,
      socioNombre: r.socio_nombre,
      telefono: r.socio_telefono,
      suscripcionId: r.id,
      actividad: r.actividad,
      etiqueta: r.etiqueta,
      importe: r.importe,
      periodicidad: r.periodicidad,
      pagadoHasta: r.pagado_hasta,
      fechaAlta: r.socio_alta,
      estado,
      dias,
    };
  });

  // El mas urgente primero (atrasado/pendiente con mas dias de retraso arriba).
  const ordenarUrgente = (a: any, b: any) => {
    const ra = RANK_ESTADO[a.estado as keyof typeof RANK_ESTADO];
    const rb = RANK_ESTADO[b.estado as keyof typeof RANK_ESTADO];
    if (ra !== rb) return rb - ra;
    return (a.dias ?? 0) - (b.dias ?? 0);
  };

  const porCobrar = items.filter((i) => i.estado === "atrasado" || i.estado === "pendiente").sort(ordenarUrgente);
  const pronto = items.filter((i) => i.estado === "pronto").sort((a, b) => (a.dias ?? 0) - (b.dias ?? 0));
  const aldia = items.filter((i) => i.estado === "aldia").sort((a, b) => (a.dias ?? 0) - (b.dias ?? 0));

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
