export type EstadoCuota = "aldia" | "pronto" | "atrasado" | "pendiente";

/** Cuenta de sesiones de un bono (calculada en el servidor, nunca guardada). */
export interface Sesiones {
  restantes: number; // negativo = se le dejó entrar a deber
  usadas: number;
  compradas: number; // respaldadas por cobros registrados
  manual: number; // del papelito (sin cobro)
  porBono: number;
}

/** Una sesión picada de un bono. */
export interface Asistencia {
  id: number;
  fecha: string; // día de la sesión
  creadoEn: string; // "YYYY-MM-DD HH:MM" (cuándo se picó)
  notas?: string | null;
}

export interface Suscripcion {
  id: number;
  socioId: number;
  actividad: string;
  etiqueta: string | null;
  importe: number;
  periodicidad: string; // mensual | bono
  pagadoHasta: string | null; // null en bonos por sesiones (no caducan por fecha)
  coberturaSinCobro: boolean; // la cobertura vigente se apuntó a mano (ningún cobro la respalda)
  activa: boolean;
  notas: string | null;
  estado: EstadoCuota;
  dias: number | null;
  // --- bonos por sesiones ---
  esBono: boolean; // bono configurado: el estado sale de las sesiones que quedan
  bonoSinConfigurar: boolean; // 'bono' de antes de v1.8 sin sesiones indicadas (sigue por fecha)
  sesionesPorBono: number | null;
  sesionesManual: number;
  sesiones: Sesiones | null;
  ultimaAsistencia: Asistencia | null;
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
  estadoResumenEsBono: boolean; // el peor estado lo aporta un bono por sesiones (la chapa habla de sesiones)
  proximaExpiracion: string | null; // ISO; la cuota activa que vence antes (null si no hay)
  ultimoPago: { fecha: string; total: number } | null; // último cobro real (tabla pagos); null si nunca pagó
}

export interface PagoLinea {
  actividad: string;
  concepto: string | null;
  importe: number;
  periodoDesde: string | null;
  periodoHasta: string | null;
  sesiones: number | null; // bono por sesiones: sesiones que compró esta línea
}

export interface Evento {
  id: number;
  fecha: string; // "YYYY-MM-DD HH:MM" (o solo fecha si es reconstruido)
  tipo: string; // alta | baja | reactivado | ficha | actividad | pago | pago_borrado | recibo | aviso | borrado
  detalle: string;
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
  sesiones: number | null; // sesiones por bono (solo tarifas de tipo bono)
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
  esBono: boolean;
  sesionesRestantes: number | null; // solo bonos por sesiones
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
  ingresos: number; // ya filtrado por actividad si se pidió ?actividad=
  porActividad: Record<string, number>; // desglose por actividad (una sola clave si hay filtro)
  nPagos: number;
  socios: number; // socios distintos que pagaron ese mes
  altas: number;
  bajas: number; // solo bajas con fecha (desde v1.3); las antiguas no salen
  retencion: number | null; // % de los que pagaron el mes anterior que repiten (null sin mes previo)
}

export interface Metricas {
  hoy: string;
  mesActual: string;
  actividad: string; // "todas" o la actividad filtrada
  rango: { desde: string; hasta: string; meses: number; dataDesde: string; dataHasta: string };
  serie: MetricaMes[];
  serieAnterior: MetricaMes[]; // mismo rango 12 meses antes, elemento a elemento
  porActividad: { actividad: string; total: number }[]; // periodo completo, SIN filtrar
  porActividadAnterior: { actividad: string; total: number }[];
  totales: { ingresos: number; nPagos: number };
  periodoAnterior: { desde: string; hasta: string; ingresos: number };
  mejorMes: { mes: string; ingresos: number }; // récord de todo el historial (no del rango)
  proyeccion: { mes: string; cobrado: number; estimado: number; dia: number; diasMes: number };
  retencionMedia: number | null;
  socios: {
    total: number;
    activos: number;
    bajas: number;
    sinCuota: number;
    coberturaManual: number; // al día/pronto solo por cobertura apuntada a mano (sin cobro)
    bonosSinConfigurar: number; // bonos de antes de v1.8 sin sesiones indicadas (llevan aviso)
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

export interface ConfigCopias {
  email: string; // correo que recibe las copias
  activo: boolean; // envío automático (al cerrar / arrancar / diario)
  ultimoEnvio: string; // "YYYY-MM-DD HH:MM" del último envío correcto ("" si nunca)
  ultimoIntento: string;
  ultimoError: string; // "" si el último intento fue bien
  ultimoMotivo: string; // cierre | arranque | diario | manual
  correoConfigurado: boolean; // hay SMTP guardado (sin él no se puede enviar)
}

export interface ResultadoCopiaEmail {
  enviado: boolean;
  motivo: string;
  porQueNo?: string;
  error?: string;
  para?: string;
  bytes?: number;
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
