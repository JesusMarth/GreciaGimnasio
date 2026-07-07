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
  nombre: string; // nombre de pila
  apellidos: string | null;
  nombreCompleto: string; // "nombre apellidos" (compuesto en el servidor)
  telefono: string | null;
  email: string | null;
  dni: string | null;
  sexo: string | null; // hombre | mujer | null
  fechaAlta: string;
  fechaNacimiento: string | null;
  estado: string; // activo | baja
  notas: string | null;
  suscripciones: Suscripcion[];
  estadoResumen: EstadoCuota | null;
  proximaExpiracion: string | null; // ISO; la cuota activa que vence antes (null si no hay)
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
  fechaAlta: string;
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

export interface MetricaMes {
  mes: string; // "YYYY-MM"
  ingresos: number;
  nPagos: number;
  socios: number; // socios distintos que pagaron ese mes
  altas: number;
}

export interface Metricas {
  hoy: string;
  mesActual: string;
  rango: { desde: string; hasta: string; meses: number; dataDesde: string; dataHasta: string };
  serie: MetricaMes[];
  porActividad: { actividad: string; total: number }[];
  totales: { ingresos: number; nPagos: number };
  periodoAnterior: { desde: string; hasta: string; ingresos: number };
  mejorMes: { mes: string; ingresos: number }; // récord de todo el historial (no del rango)
  socios: {
    total: number;
    activos: number;
    bajas: number;
    sinCuota: number;
    aldia: number;
    pronto: number;
    atrasado: number;
    pendiente: number;
  };
}

export interface CopiaInfo {
  archivo: string;
  tipo: string; // auto | manual | pre-restore
  creado: string; // ISO
  bytes: number;
}

export interface ConfigEmail {
  host: string;
  port: number;
  secure: boolean;
  usuario: string;
  remitente: string;
  tienePass: boolean; // si ya hay una contraseña guardada (nunca se devuelve la real)
}

export interface DatosRecibo {
  nombre: string;
  nif: string;
  direccion: string;
  tipoDoc: string; // "Recibo" | "Factura" | …
  iva: string; // "no" | "incluido" | "exento"
  ivaTipo: number;
  pie: string;
}
