import { Router } from "express";
import { db } from "../db.ts";
import { addMeses, estadoDe, hoyISO, type EstadoCuota } from "../util.ts";

export const metricasRouter = Router();

const MES = /^\d{4}-\d{2}$/;

/** Lista de meses "YYYY-MM" de `desde` a `hasta` (ambos incluidos), ascendente. */
function mesesEntre(desde: string, hasta: string): string[] {
  const out: string[] = [];
  let cur = desde;
  // Tope de seguridad: nunca más de 120 meses (10 años).
  for (let i = 0; i < 120 && cur <= hasta; i++) {
    out.push(cur);
    cur = addMeses(cur + "-01", 1).slice(0, 7);
  }
  return out;
}

// Métricas de ingresos. Acepta un rango por mes (?desde=YYYY-MM&hasta=YYYY-MM) o,
// por compatibilidad, ?meses=N (últimos N meses). Todo centrado en ganancias.
metricasRouter.get("/metricas", (req, res) => {
  const hoy = hoyISO();
  const mesActual = hoy.slice(0, 7);

  // Rango de datos existente (para acotar y para el preset "Todo"). Como es una
  // pantalla de INGRESOS, "Todo" arranca en el primer cobro (no en las altas, que
  // pueden estar puestas años atrás); si aún no hay cobros, cae en la primera alta.
  const pg = db.prepare("SELECT MIN(substr(fecha,1,7)) AS mn, MAX(substr(fecha,1,7)) AS mx FROM pagos").get() as { mn: string | null; mx: string | null };
  const alMin = (db.prepare("SELECT MIN(substr(fecha_alta,1,7)) AS mn FROM socios").get() as { mn: string | null }).mn;
  const dataDesde = pg.mn || alMin || mesActual;
  const dataHasta = [pg.mx, mesActual].filter(Boolean).reduce((a, b) => (a! > b! ? a : b))!;

  // Rango pedido.
  let desde = String(req.query.desde || "");
  let hasta = String(req.query.hasta || "");
  if (!(MES.test(desde) && MES.test(hasta))) {
    const meses = Math.min(Math.max(Number(req.query.meses) || 12, 1), 120);
    hasta = dataHasta;
    desde = addMeses(hasta + "-01", -(meses - 1)).slice(0, 7);
  }
  if (desde > hasta) [desde, hasta] = [hasta, desde];
  if (desde < dataDesde) desde = dataDesde; // no pintar meses vacíos previos a cualquier dato ("Todo")
  if (hasta > dataHasta) hasta = dataHasta;
  if (mesesEntre(desde, hasta).length >= 120) desde = addMeses(hasta + "-01", -119).slice(0, 7);

  const serieMeses = mesesEntre(desde, hasta);

  // Ingresos y nº de socios que pagan por mes dentro del rango.
  const ingresosRaw = db
    .prepare(
      "SELECT substr(fecha,1,7) AS mes, COALESCE(SUM(total),0) AS total, COUNT(*) AS n, COUNT(DISTINCT socio_id) AS socios " +
        "FROM pagos WHERE substr(fecha,1,7) BETWEEN ? AND ? GROUP BY mes"
    )
    .all(desde, hasta) as { mes: string; total: number; n: number; socios: number }[];
  const altasRaw = db
    .prepare(
      "SELECT substr(fecha_alta,1,7) AS mes, COUNT(*) AS n FROM socios " +
        "WHERE substr(fecha_alta,1,7) BETWEEN ? AND ? GROUP BY mes"
    )
    .all(desde, hasta) as { mes: string; n: number }[];

  const ingByMes = new Map(ingresosRaw.map((r) => [r.mes, r]));
  const altaByMes = new Map(altasRaw.map((r) => [r.mes, r.n]));
  const serie = serieMeses.map((mes) => ({
    mes,
    ingresos: ingByMes.get(mes)?.total ?? 0,
    nPagos: ingByMes.get(mes)?.n ?? 0,
    socios: ingByMes.get(mes)?.socios ?? 0,
    altas: altaByMes.get(mes) ?? 0,
  }));

  // Desglose por actividad y por método dentro del rango.
  const porActividad = db
    .prepare(
      "SELECT l.actividad AS actividad, COALESCE(SUM(l.importe),0) AS total FROM pago_lineas l " +
        "JOIN pagos p ON p.id = l.pago_id WHERE substr(p.fecha,1,7) BETWEEN ? AND ? " +
        "GROUP BY l.actividad ORDER BY total DESC"
    )
    .all(desde, hasta) as { actividad: string; total: number }[];
  const totales = serie.reduce(
    (a, x) => ({ ingresos: a.ingresos + x.ingresos, nPagos: a.nPagos + x.nPagos }),
    { ingresos: 0, nPagos: 0 }
  );

  // Comparativa interanual: el MISMO rango de meses, 12 meses antes.
  const desdeAnt = addMeses(desde + "-01", -12).slice(0, 7);
  const hastaAnt = addMeses(hasta + "-01", -12).slice(0, 7);
  const periodoAnteriorIngresos = (
    db.prepare("SELECT COALESCE(SUM(total),0) AS t FROM pagos WHERE substr(fecha,1,7) BETWEEN ? AND ?").get(desdeAnt, hastaAnt) as any
  ).t;

  // Mejor mes de SIEMPRE (récord de todo el historial, no del rango elegido).
  const mm = db
    .prepare("SELECT substr(fecha,1,7) AS mes, COALESCE(SUM(total),0) AS total FROM pagos GROUP BY mes ORDER BY total DESC LIMIT 1")
    .get() as { mes: string; total: number } | undefined;
  const mejorMes = mm ? { mes: mm.mes, ingresos: mm.total } : { mes: "", ingresos: 0 };

  // Snapshot de socios: activos/bajas + morosidad (peor estado de sus cuotas activas).
  const totalSocios = (db.prepare("SELECT COUNT(*) AS n FROM socios").get() as any).n;
  const activos = (db.prepare("SELECT COUNT(*) AS n FROM socios WHERE estado='activo'").get() as any).n;
  const bajas = totalSocios - activos;
  const subsActivas = db
    .prepare(
      "SELECT su.socio_id AS socioId, su.pagado_hasta AS pagadoHasta FROM suscripciones su " +
        "JOIN socios so ON so.id = su.socio_id WHERE su.activa = 1 AND so.estado = 'activo'"
    )
    .all() as { socioId: number; pagadoHasta: string | null }[];
  const rank: Record<EstadoCuota, number> = { atrasado: 3, pendiente: 2, pronto: 1, aldia: 0 };
  const peorPorSocio = new Map<number, EstadoCuota>();
  for (const s of subsActivas) {
    const { estado } = estadoDe(s.pagadoHasta, hoy);
    const prev = peorPorSocio.get(s.socioId);
    if (!prev || rank[estado] > rank[prev]) peorPorSocio.set(s.socioId, estado);
  }
  const morosidad = { aldia: 0, pronto: 0, atrasado: 0, pendiente: 0 };
  for (const e of peorPorSocio.values()) morosidad[e]++;
  const sinCuota = activos - peorPorSocio.size;

  res.json({
    hoy,
    mesActual,
    // dataDesde/dataHasta = inicio y fin del historial real (primer y último cobro).
    rango: { desde, hasta, meses: serieMeses.length, dataDesde, dataHasta },
    serie,
    porActividad,
    totales,
    periodoAnterior: { desde: desdeAnt, hasta: hastaAnt, ingresos: periodoAnteriorIngresos },
    mejorMes,
    socios: { total: totalSocios, activos, bajas, sinCuota, ...morosidad },
  });
});
