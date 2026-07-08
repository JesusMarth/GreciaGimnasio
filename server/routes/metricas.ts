import { Router } from "express";
import { db } from "../db.ts";
import { addMeses, estadoDe, hoyISO, type EstadoCuota } from "../util.ts";

export const metricasRouter = Router();

const MES = /^\d{4}-\d{2}$/;
const ACTIVIDADES = ["gimnasio", "karate", "pilates"];

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

interface MesIngresos {
  ingresos: number;
  porActividad: Record<string, number>;
  nPagos: number;
  socios: number;
}

/**
 * Ingresos por mes en el rango, con desglose por actividad. Si `actividad` viene,
 * los importes salen SOLO de las líneas de esa actividad y nPagos/socios cuentan
 * solo los pagos que incluyen una línea de ella.
 */
function ingresosPorMes(desde: string, hasta: string, actividad: string | null): Map<string, MesIngresos> {
  const out = new Map<string, MesIngresos>();
  if (actividad) {
    const filas = db
      .prepare(
        "SELECT substr(p.fecha,1,7) AS mes, COALESCE(SUM(l.importe),0) AS total, " +
          "COUNT(DISTINCT p.id) AS n, COUNT(DISTINCT p.socio_id) AS socios " +
          "FROM pago_lineas l JOIN pagos p ON p.id = l.pago_id " +
          "WHERE l.actividad = ? AND substr(p.fecha,1,7) BETWEEN ? AND ? GROUP BY mes"
      )
      .all(actividad, desde, hasta) as { mes: string; total: number; n: number; socios: number }[];
    for (const f of filas)
      out.set(f.mes, { ingresos: f.total, porActividad: { [actividad]: f.total }, nPagos: f.n, socios: f.socios });
  } else {
    const filas = db
      .prepare(
        "SELECT substr(fecha,1,7) AS mes, COALESCE(SUM(total),0) AS total, COUNT(*) AS n, COUNT(DISTINCT socio_id) AS socios " +
          "FROM pagos WHERE substr(fecha,1,7) BETWEEN ? AND ? GROUP BY mes"
      )
      .all(desde, hasta) as { mes: string; total: number; n: number; socios: number }[];
    for (const f of filas) out.set(f.mes, { ingresos: f.total, porActividad: {}, nPagos: f.n, socios: f.socios });
    const desglose = db
      .prepare(
        "SELECT substr(p.fecha,1,7) AS mes, l.actividad AS actividad, COALESCE(SUM(l.importe),0) AS total " +
          "FROM pago_lineas l JOIN pagos p ON p.id = l.pago_id " +
          "WHERE substr(p.fecha,1,7) BETWEEN ? AND ? GROUP BY mes, l.actividad"
      )
      .all(desde, hasta) as { mes: string; actividad: string; total: number }[];
    for (const d of desglose) {
      const m = out.get(d.mes);
      if (m) m.porActividad[d.actividad] = d.total;
    }
  }
  return out;
}

/** Recuento por mes de una fecha de socios (fecha_alta o fecha_baja). */
function sociosPorMes(campo: "fecha_alta" | "fecha_baja", desde: string, hasta: string): Map<string, number> {
  const filas = db
    .prepare(
      `SELECT substr(${campo},1,7) AS mes, COUNT(*) AS n FROM socios ` +
        `WHERE ${campo} IS NOT NULL AND substr(${campo},1,7) BETWEEN ? AND ? GROUP BY mes`
    )
    .all(desde, hasta) as { mes: string; n: number }[];
  return new Map(filas.map((f) => [f.mes, f.n]));
}

/** Suma por actividad de todo un rango (siempre las 3, para la tarjeta de reparto). */
function totalPorActividad(desde: string, hasta: string): { actividad: string; total: number }[] {
  return db
    .prepare(
      "SELECT l.actividad AS actividad, COALESCE(SUM(l.importe),0) AS total FROM pago_lineas l " +
        "JOIN pagos p ON p.id = l.pago_id WHERE substr(p.fecha,1,7) BETWEEN ? AND ? " +
        "GROUP BY l.actividad ORDER BY total DESC"
    )
    .all(desde, hasta) as { actividad: string; total: number }[];
}

// Métricas de ingresos. Rango por mes (?desde=YYYY-MM&hasta=YYYY-MM o ?meses=N) y
// filtro opcional ?actividad=gimnasio|karate|pilates (por defecto, todas).
metricasRouter.get("/metricas", (req, res) => {
  const hoy = hoyISO();
  const mesActual = hoy.slice(0, 7);
  const actividad = ACTIVIDADES.includes(String(req.query.actividad)) ? String(req.query.actividad) : null;

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
  // Mismo rango, 12 meses antes (comparativa interanual, elemento a elemento).
  const desdeAnt = addMeses(desde + "-01", -12).slice(0, 7);
  const hastaAnt = addMeses(hasta + "-01", -12).slice(0, 7);
  const serieMesesAnt = mesesEntre(desdeAnt, hastaAnt);

  // ── Retención: de los socios que pagaron en M-1, % que repite en M. Se calcula
  // sobre TODOS los pagos (mide si el socio sigue viniendo, con la actividad que
  // sea), cargando una sola vez mes → conjunto de socios que pagaron.
  const pagosSocioMes = db
    .prepare("SELECT DISTINCT substr(fecha,1,7) AS mes, socio_id AS socio FROM pagos")
    .all() as { mes: string; socio: number }[];
  const pagaronEn = new Map<string, Set<number>>();
  for (const f of pagosSocioMes) {
    if (!pagaronEn.has(f.mes)) pagaronEn.set(f.mes, new Set());
    pagaronEn.get(f.mes)!.add(f.socio);
  }
  const retencionDe = (mes: string): number | null => {
    const prev = pagaronEn.get(addMeses(mes + "-01", -1).slice(0, 7));
    if (!prev || prev.size === 0) return null;
    const cur = pagaronEn.get(mes) ?? new Set<number>();
    let repiten = 0;
    for (const s of prev) if (cur.has(s)) repiten++;
    return Math.round((repiten / prev.size) * 100);
  };

  // ── Series (la actual y la del año anterior, misma longitud).
  const ingCur = ingresosPorMes(desde, hasta, actividad);
  const ingAnt = ingresosPorMes(desdeAnt, hastaAnt, actividad);
  const altasCur = sociosPorMes("fecha_alta", desde, hasta);
  const altasAnt = sociosPorMes("fecha_alta", desdeAnt, hastaAnt);
  const bajasCur = sociosPorMes("fecha_baja", desde, hasta);
  const bajasAnt = sociosPorMes("fecha_baja", desdeAnt, hastaAnt);

  const construir = (meses: string[], ing: Map<string, MesIngresos>, altas: Map<string, number>, bajas: Map<string, number>) =>
    meses.map((mes) => ({
      mes,
      ingresos: ing.get(mes)?.ingresos ?? 0,
      porActividad: ing.get(mes)?.porActividad ?? {},
      nPagos: ing.get(mes)?.nPagos ?? 0,
      socios: ing.get(mes)?.socios ?? 0,
      altas: altas.get(mes) ?? 0,
      bajas: bajas.get(mes) ?? 0,
      retencion: retencionDe(mes),
    }));
  const serie = construir(serieMeses, ingCur, altasCur, bajasCur);
  const serieAnterior = construir(serieMesesAnt, ingAnt, altasAnt, bajasAnt);

  const totales = serie.reduce(
    (a, x) => ({ ingresos: a.ingresos + x.ingresos, nPagos: a.nPagos + x.nPagos }),
    { ingresos: 0, nPagos: 0 }
  );
  const periodoAnteriorIngresos = serieAnterior.reduce((a, x) => a + x.ingresos, 0);

  // Media de las retenciones con dato dentro del rango.
  const rets = serie.map((s) => s.retencion).filter((r): r is number => r != null);
  const retencionMedia = rets.length ? Math.round(rets.reduce((a, r) => a + r, 0) / rets.length) : null;

  // ── Proyección del mes en curso (siempre del mes actual, respeta ?actividad).
  const cobradoCurso = ingresosPorMes(mesActual, mesActual, actividad).get(mesActual)?.ingresos ?? 0;
  const dia = Number(hoy.slice(8, 10));
  const diasMes = new Date(Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)), 0).getDate();
  const proyeccion = {
    mes: mesActual,
    cobrado: cobradoCurso,
    estimado: dia > 0 ? Math.round((cobradoCurso / dia) * diasMes) : cobradoCurso,
    dia,
    diasMes,
  };

  // ── Reparto por actividad del periodo (SIEMPRE sin filtrar: la tarjeta enseña
  // las tres y atenúa las no seleccionadas) + el mismo rango del año anterior
  // para la tendencia "▲ x% vs. mismo periodo anterior".
  const porActividad = totalPorActividad(desde, hasta);
  const porActividadAnterior = totalPorActividad(desdeAnt, hastaAnt);

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
      "SELECT su.socio_id AS socioId, su.pagado_hasta AS pagadoHasta, su.cobertura_manual AS coberturaManual FROM suscripciones su " +
        "JOIN socios so ON so.id = su.socio_id WHERE su.activa = 1 AND so.estado = 'activo'"
    )
    .all() as { socioId: number; pagadoHasta: string | null; coberturaManual: string | null }[];
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
  // Socios cuya cobertura vigente está apuntada a mano (alta "ya estaba pagado"):
  // aparecen al día/vence pronto pero NINGÚN cobro registrado respalda ese dinero,
  // por eso no salen en Ingresos. Se muestra para que el descuadre no despiste.
  const coberturaManual = new Set(
    subsActivas
      .filter((s) => s.pagadoHasta && s.pagadoHasta >= hoy && s.coberturaManual === s.pagadoHasta)
      .map((s) => s.socioId)
  ).size;

  res.json({
    hoy,
    mesActual,
    actividad: actividad ?? "todas",
    // dataDesde/dataHasta = inicio y fin del historial real (primer y último cobro).
    rango: { desde, hasta, meses: serieMeses.length, dataDesde, dataHasta },
    serie,
    serieAnterior,
    porActividad,
    porActividadAnterior,
    totales,
    periodoAnterior: { desde: desdeAnt, hasta: hastaAnt, ingresos: periodoAnteriorIngresos },
    mejorMes,
    proyeccion,
    retencionMedia,
    socios: { total: totalSocios, activos, bajas, sinCuota, coberturaManual, ...morosidad },
  });
});
