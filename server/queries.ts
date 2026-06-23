import { db } from "./db.ts";
import { estadoDe, hoyISO, peorEstado, type EstadoCuota } from "./util.ts";

// Tipos de fila tal cual salen de SQLite.
export interface SocioRow {
  id: number;
  nombre: string;
  telefono: string | null;
  email: string | null;
  fecha_alta: string;
  fecha_nacimiento: string | null;
  estado: string;
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
  activa: number;
  notas: string | null;
  creado_en: string;
}

const stmtSubsDeSocio = db.prepare(
  "SELECT * FROM suscripciones WHERE socio_id = ? ORDER BY activa DESC, actividad"
);

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
    activa: !!s.activa,
    notas: s.notas,
    estado,
    dias,
  };
}

/** Socio con sus suscripciones y el estado-resumen (el mas urgente entre las activas). */
export function socioConResumen(s: SocioRow, hoy = hoyISO()) {
  const subs = (stmtSubsDeSocio.all(s.id) as SuscripcionRow[]).map((x) => suscripcionConEstado(x, hoy));
  const estadosActivos = subs.filter((x) => x.activa).map((x) => x.estado as EstadoCuota);
  return {
    id: s.id,
    nombre: s.nombre,
    telefono: s.telefono,
    email: s.email,
    fechaAlta: s.fecha_alta,
    fechaNacimiento: s.fecha_nacimiento,
    estado: s.estado,
    notas: s.notas,
    suscripciones: subs,
    estadoResumen: peorEstado(estadosActivos),
  };
}
