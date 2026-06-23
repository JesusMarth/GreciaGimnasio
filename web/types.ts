export type EstadoCuota = "aldia" | "pronto" | "atrasado" | "pendiente";

export interface Suscripcion {
  id: number;
  socioId: number;
  actividad: string;
  etiqueta: string | null;
  importe: number;
  periodicidad: string;
  pagadoHasta: string | null;
  activa: boolean;
  notas: string | null;
  estado: EstadoCuota;
  dias: number | null;
}

export interface Socio {
  id: number;
  nombre: string;
  telefono: string | null;
  email: string | null;
  fechaAlta: string;
  fechaNacimiento: string | null;
  estado: string; // activo | baja
  notas: string | null;
  suscripciones: Suscripcion[];
  estadoResumen: EstadoCuota | null;
}

export interface PagoLinea {
  actividad: string;
  concepto: string | null;
  importe: number;
  periodoDesde: string | null;
  periodoHasta: string | null;
}

export interface Pago {
  id: number;
  fecha: string;
  metodo: string;
  total: number;
  notas: string | null;
  lineas: PagoLinea[];
}

export interface Tarifa {
  id: number;
  nombre: string;
  actividad: string;
  importe: number;
  periodicidad: string;
}

export interface DashItem {
  socioId: number;
  socioNombre: string;
  telefono: string | null;
  suscripcionId: number;
  actividad: string;
  etiqueta: string | null;
  importe: number;
  periodicidad: string;
  pagadoHasta: string | null;
  estado: EstadoCuota;
  dias: number | null;
}

export interface Dashboard {
  hoy: string;
  resumen: {
    porCobrar: number;
    pronto: number;
    aldia: number;
    totalSocios: number;
    totalActivos: number;
  };
  ingresosMes: {
    total: number;
    porActividad: { actividad: string; total: number }[];
    porMetodo: { metodo: string; total: number }[];
  };
  porCobrar: DashItem[];
  pronto: DashItem[];
  aldia: DashItem[];
}
