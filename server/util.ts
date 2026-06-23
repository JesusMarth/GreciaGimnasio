// Utilidades de fechas y estados de cuota. Todo en fechas ISO "YYYY-MM-DD".

/** Fecha de hoy en horario local, como "YYYY-MM-DD". */
export function hoyISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

/** Suma (o resta, con n negativo) meses a una fecha ISO, recortando el dia al fin de mes. */
export function addMeses(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const ultimoDia = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, ultimoDia));
  return t.toISOString().slice(0, 10);
}

/** Diferencia en dias enteros: a - b. Positivo = a es posterior. */
export function diffDias(aISO: string, bISO: string): number {
  const a = Date.parse(aISO + "T00:00:00Z");
  const b = Date.parse(bISO + "T00:00:00Z");
  return Math.round((a - b) / 86400000);
}

/** Dias de antelacion con que se considera "vence pronto". */
export const UMBRAL_PRONTO = 7;

export type EstadoCuota = "aldia" | "pronto" | "atrasado" | "pendiente";

export interface Estado {
  estado: EstadoCuota;
  /** Dias restantes hasta el vencimiento (negativo = dias de atraso). null si nunca pago. */
  dias: number | null;
}

/**
 * Estado de una suscripcion segun "pagado hasta".
 *  - pendiente: nunca se registro un pago (sin fecha)
 *  - atrasado : la fecha de cobertura ya paso
 *  - pronto   : vence dentro de UMBRAL_PRONTO dias
 *  - aldia    : cubierto con holgura
 */
export function estadoDe(pagadoHasta: string | null, hoy: string): Estado {
  if (!pagadoHasta) return { estado: "pendiente", dias: null };
  const dias = diffDias(pagadoHasta, hoy);
  if (dias < 0) return { estado: "atrasado", dias };
  if (dias <= UMBRAL_PRONTO) return { estado: "pronto", dias };
  return { estado: "aldia", dias };
}

/** Primer dia del mes actual, "YYYY-MM-01". */
export function inicioMes(hoy: string): string {
  return hoy.slice(0, 7) + "-01";
}

/** Gravedad relativa de cada estado (mayor = mas urgente). */
export const RANK_ESTADO: Record<EstadoCuota, number> = {
  atrasado: 3,
  pendiente: 2,
  pronto: 1,
  aldia: 0,
};

/** El estado mas urgente de un conjunto. null si la lista esta vacia. */
export function peorEstado(estados: EstadoCuota[]): EstadoCuota | null {
  if (estados.length === 0) return null;
  return estados.reduce((peor, e) => (RANK_ESTADO[e] > RANK_ESTADO[peor] ? e : peor), "aldia" as EstadoCuota);
}
