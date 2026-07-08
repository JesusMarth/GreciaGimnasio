import { db } from "./db.ts";
import { estadoDe, hoyISO, peorEstado, type EstadoCuota } from "./util.ts";

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
  activa: number;
  notas: string | null;
  creado_en: string;
}

// Nota: preparamos por llamada (better-sqlite3 ya cachea por SQL internamente). Así,
// si se restaura una copia y se reabre la conexión, no queda un statement colgando
// de la conexión antigua.
const SQL_SUBS_DE_SOCIO = "SELECT * FROM suscripciones WHERE socio_id = ? ORDER BY activa DESC, actividad";

/** Suscripcion enriquecida con su estado calculado. */
export function suscripcionConEstado(s: SuscripcionRow, hoy: string) {
  const { estado, dias } = estadoDe(s.pagado_hasta, hoy);
  return {
    id: s.id,
    socioId: s.socio_id,
    actividad: s.actividad,
    etiqueta: s.etiqueta,
    importe: s.importe,
    periodicidad: s.periodicidad,
    pagadoHasta: s.pagado_hasta,
    // true = la cobertura vigente esta puesta a mano, ningun cobro llega hasta ahi
    // (pagado_hasta solo iguala a cobertura_manual cuando ningun pago la supera).
    coberturaSinCobro: !!s.pagado_hasta && s.cobertura_manual === s.pagado_hasta,
    activa: !!s.activa,
    notas: s.notas,
    estado,
    dias,
  };
}

/** Socio con sus suscripciones y el estado-resumen (el mas urgente entre las activas). */
export function socioConResumen(s: SocioRow, hoy = hoyISO()) {
  const subs = (db.prepare(SQL_SUBS_DE_SOCIO).all(s.id) as SuscripcionRow[]).map((x) => suscripcionConEstado(x, hoy));
  const activas = subs.filter((x) => x.activa);
  const estadosActivos = activas.map((x) => x.estado as EstadoCuota);
  // Fecha de expiración del socio = la más temprana entre sus cuotas activas que
  // tienen pago (pagadoHasta). Las fechas ISO (YYYY-MM-DD) ordenan cronológicamente
  // como texto. Si ninguna activa tiene fecha (sin activas o todas sin pagar): null.
  const fechasActivas = activas.map((x) => x.pagadoHasta).filter((d): d is string => !!d);
  const proximaExpiracion = fechasActivas.length ? fechasActivas.reduce((a, b) => (a < b ? a : b)) : null;
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
    estadoResumen: peorEstado(estadosActivos),
    proximaExpiracion,
  };
}
