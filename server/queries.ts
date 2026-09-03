import { db } from "./db.ts";
import { estadoBono, estadoDe, hoyISO, peorEstado, type EstadoCuota } from "./util.ts";

// Tipos de fila tal cual salen de SQLite.
export interface SocioRow {
  id: number;
  nombre: string;
  apellidos: string | null;
  telefono: string | null;
  email: string | null;
  dni: string | null;
  sexo: string | null;
  fecha_alta: string;
  fecha_nacimiento: string | null;
  estado: string;
  fecha_baja: string | null; // solo bajas posteriores a v1.3 (antes no se guardaba)
  notas: string | null;
  creado_en: string;
}

export interface SuscripcionRow {
  id: number;
  socio_id: number;
  actividad: string;
  etiqueta: string | null;
  importe: number;
  periodicidad: string;
  pagado_hasta: string | null;
  cobertura_manual: string | null; // cobertura puesta a mano (sin cobro registrado)
  sesiones_por_bono: number | null; // bono por sesiones: sesiones que trae cada bono (null = por fecha)
  sesiones_manual: number; // sesiones del papelito apuntadas a mano (sin cobro)
  activa: number;
  notas: string | null;
  creado_en: string;
}

/** ¿Esta suscripción se lleva por sesiones (bono configurado)? */
export function esBonoPorSesiones(s: Pick<SuscripcionRow, "periodicidad" | "sesiones_por_bono">): boolean {
  return s.periodicidad === "bono" && !!s.sesiones_por_bono && s.sesiones_por_bono > 0;
}

export interface Sesiones {
  restantes: number; // puede ser negativo si se le dejó entrar a deber
  usadas: number; // asistencias picadas
  compradas: number; // sesiones respaldadas por cobros registrados
  manual: number; // sesiones del papelito (sin cobro)
  porBono: number;
}

/**
 * Cuenta de sesiones de un bono, siempre CALCULADA (nunca guardada): lo comprado
 * en pagos + lo apuntado a mano − lo picado. Así borrar un pago o deshacer una
 * sesión cuadra solo, sin recálculos.
 * Regla para líneas de pago sin `sesiones` (NULL): son cobros de bonos anteriores
 * a v1.8 (se apuntaban como un mes) → cuentan como UN bono completo cada una, para
 * que lo ya cobrado no se pierda. Las líneas con 0 son de cuando la actividad era
 * mensual y no cuentan.
 */
export function sesionesDe(s: SuscripcionRow): Sesiones {
  const porBono = s.sesiones_por_bono ?? 0;
  const compradas =
    (db.prepare("SELECT COALESCE(SUM(COALESCE(sesiones, ?)), 0) AS n FROM pago_lineas WHERE suscripcion_id = ?").get(porBono, s.id) as { n: number }).n;
  const usadas = (db.prepare("SELECT COUNT(*) AS n FROM asistencias WHERE suscripcion_id = ?").get(s.id) as { n: number }).n;
  const manual = s.sesiones_manual ?? 0;
  return { restantes: compradas + manual - usadas, usadas, compradas, manual, porBono };
}

const SQL_ULTIMA_ASISTENCIA = "SELECT id, fecha, creado_en FROM asistencias WHERE suscripcion_id = ? ORDER BY fecha DESC, id DESC LIMIT 1";

// Nota: preparamos por llamada (better-sqlite3 ya cachea por SQL internamente). Así,
// si se restaura una copia y se reabre la conexión, no queda un statement colgando
// de la conexión antigua.
const SQL_SUBS_DE_SOCIO = "SELECT * FROM suscripciones WHERE socio_id = ? ORDER BY activa DESC, actividad";
const SQL_ULTIMO_PAGO = "SELECT id, fecha, total FROM pagos WHERE socio_id = ? ORDER BY fecha DESC, id DESC LIMIT 1";

/** Suscripcion enriquecida con su estado calculado. */
export function suscripcionConEstado(s: SuscripcionRow, hoy: string) {
  const esBono = esBonoPorSesiones(s);
  // Bono por sesiones: el estado sale de las sesiones que quedan, no de una fecha.
  // pagado_hasta se conserva en la BD (no se toca) pero no se usa ni se muestra.
  const sesiones = esBono ? sesionesDe(s) : null;
  const { estado, dias } = sesiones ? estadoBono(sesiones.restantes, sesiones.compradas + sesiones.manual) : estadoDe(s.pagado_hasta, hoy);
  const ultima = sesiones
    ? ((db.prepare(SQL_ULTIMA_ASISTENCIA).get(s.id) as { id: number; fecha: string; creado_en: string } | undefined) ?? null)
    : null;
  return {
    id: s.id,
    socioId: s.socio_id,
    actividad: s.actividad,
    etiqueta: s.etiqueta,
    importe: s.importe,
    periodicidad: s.periodicidad,
    pagadoHasta: esBono ? null : s.pagado_hasta,
    // true = la cobertura vigente esta puesta a mano, ningun cobro llega hasta ahi
    // (pagado_hasta solo iguala a cobertura_manual cuando ningun pago la supera).
    // En bonos: está "al día" solo gracias a las sesiones del papelito (sin cobro).
    coberturaSinCobro: sesiones
      ? sesiones.restantes > 0 && sesiones.compradas === 0 && sesiones.manual > 0
      : !!s.pagado_hasta && s.cobertura_manual === s.pagado_hasta,
    activa: !!s.activa,
    notas: s.notas,
    estado,
    dias,
    // --- bonos por sesiones ---
    esBono,
    // 'bono' de antes de v1.8 al que aún no se le han indicado las sesiones: sigue
    // funcionando por fecha y lleva aviso para que el dueño lo configure.
    bonoSinConfigurar: s.periodicidad === "bono" && !esBono,
    sesionesPorBono: s.sesiones_por_bono,
    sesionesManual: s.sesiones_manual ?? 0,
    sesiones,
    ultimaAsistencia: ultima ? { id: ultima.id, fecha: ultima.fecha, creadoEn: ultima.creado_en } : null,
  };
}

export type SuscripcionEnriquecida = ReturnType<typeof suscripcionConEstado>;

/** Socio con sus suscripciones y el estado-resumen (el mas urgente entre las activas). */
export function socioConResumen(s: SocioRow, hoy = hoyISO()) {
  const subs = (db.prepare(SQL_SUBS_DE_SOCIO).all(s.id) as SuscripcionRow[]).map((x) => suscripcionConEstado(x, hoy));
  const activas = subs.filter((x) => x.activa);
  const estadosActivos = activas.map((x) => x.estado as EstadoCuota);
  const estadoResumen = peorEstado(estadosActivos);
  // ¿El peor estado lo aporta un bono por sesiones? Entonces la chapa del socio
  // debe hablar de sesiones (Agotado / Sin bono…) y no de fechas. Si empatan una
  // cuota por fecha y un bono, manda la cuota por fecha (es la que "vence").
  const estadoResumenEsBono = estadoResumen !== null && activas.filter((x) => x.estado === estadoResumen).every((x) => x.esBono);
  // Fecha de expiración del socio = la más temprana entre sus cuotas activas que
  // tienen pago (pagadoHasta). Las fechas ISO (YYYY-MM-DD) ordenan cronológicamente
  // como texto. Si ninguna activa tiene fecha (sin activas o todas sin pagar): null.
  // Los bonos por sesiones no tienen fecha (pagadoHasta viene null) y no entran.
  const fechasActivas = activas.map((x) => x.pagadoHasta).filter((d): d is string => !!d);
  const proximaExpiracion = fechasActivas.length ? fechasActivas.reduce((a, b) => (a < b ? a : b)) : null;
  // Último cobro real del socio (tabla pagos): alimenta la columna "Último pago"
  // de la lista, su filtro por importe y el Excel (que usa `id` para desglosar
  // las líneas del cobro). null si nunca se le cobró en la app.
  const ultimoPago = (db.prepare(SQL_ULTIMO_PAGO).get(s.id) as { id: number; fecha: string; total: number } | undefined) ?? null;
  return {
    id: s.id,
    nombre: s.nombre,
    apellidos: s.apellidos,
    nombreCompleto: [s.nombre, s.apellidos].filter(Boolean).join(" "),
    telefono: s.telefono,
    email: s.email,
    dni: s.dni,
    sexo: s.sexo,
    fechaAlta: s.fecha_alta,
    fechaNacimiento: s.fecha_nacimiento,
    estado: s.estado,
    notas: s.notas,
    suscripciones: subs,
    estadoResumen,
    estadoResumenEsBono,
    proximaExpiracion,
    ultimoPago,
  };
}
