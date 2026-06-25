import type { Socio, EstadoCuota } from "./types.ts";

// Lógica de filtrado de socios, PURA (sin React/DOM) para poder probarla a solas.

export interface RangoFecha {
  desde: string | null; // ISO YYYY-MM-DD (incluido)
  hasta: string | null; // ISO YYYY-MM-DD (incluido)
}

export interface FiltrosSocios {
  actividades: string[]; // OR sobre actividades activas; vacío = todas
  estado: string[]; // 'activo' | 'baja'; vacío = ambos
  cuota: string[]; // grupos: 'pendiente' | 'pronto' | 'aldia' | 'sin'; vacío = todos
  fecha: RangoFecha; // sobre la fecha de alta
}

export const FILTROS_VACIOS: FiltrosSocios = { actividades: [], estado: [], cuota: [], fecha: { desde: null, hasta: null } };

/** Agrupa el estado de cuota del socio en categorías filtrables. */
export function grupoCuota(e: EstadoCuota | null): string {
  if (e === "atrasado" || e === "pendiente") return "pendiente";
  if (e === "pronto") return "pronto";
  if (e === "aldia") return "aldia";
  return "sin"; // sin cuotas activas
}

/** ¿Hay algún filtro activo? (útil para el botón "Limpiar" y para el export). */
export function hayFiltrosActivos(f: FiltrosSocios): boolean {
  return f.actividades.length > 0 || f.estado.length > 0 || f.cuota.length > 0 || f.fecha.desde !== null || f.fecha.hasta !== null;
}

export function filtrarSocios(socios: Socio[], f: FiltrosSocios): Socio[] {
  return socios.filter((s) => {
    if (f.actividades.length && !s.suscripciones.some((x) => x.activa && f.actividades.includes(x.actividad))) return false;
    if (f.estado.length && !f.estado.includes(s.estado)) return false;
    if (f.cuota.length && !f.cuota.includes(grupoCuota(s.estadoResumen))) return false;
    if (f.fecha.desde && s.fechaAlta < f.fecha.desde) return false;
    if (f.fecha.hasta && s.fechaAlta > f.fecha.hasta) return false;
    return true;
  });
}

// --- Rangos de fecha por preset, relativos a `hoy` (se pasa como argumento para
//     que la función sea determinista y testeable) ---

export type PresetFecha = "hoy" | "ayer" | "ult7" | "semana" | "mes" | "anio";

function aDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function aISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function sumarDias(iso: string, n: number): string {
  const d = aDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return aISO(d);
}

export function rangoDePreset(preset: PresetFecha, hoy: string): RangoFecha {
  const d = aDate(hoy);
  switch (preset) {
    case "hoy":
      return { desde: hoy, hasta: hoy };
    case "ayer": {
      const a = sumarDias(hoy, -1);
      return { desde: a, hasta: a };
    }
    case "ult7":
      return { desde: sumarDias(hoy, -6), hasta: hoy }; // hoy + 6 días atrás = 7 días
    case "semana": {
      const dow = (d.getUTCDay() + 6) % 7; // 0 = lunes
      const lunes = sumarDias(hoy, -dow);
      return { desde: lunes, hasta: sumarDias(lunes, 6) };
    }
    case "mes": {
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth();
      return { desde: aISO(new Date(Date.UTC(y, m, 1))), hasta: aISO(new Date(Date.UTC(y, m + 1, 0))) };
    }
    case "anio": {
      const y = d.getUTCFullYear();
      return { desde: `${y}-01-01`, hasta: `${y}-12-31` };
    }
  }
}

export function rangoDeAnio(anio: number): RangoFecha {
  return { desde: `${anio}-01-01`, hasta: `${anio}-12-31` };
}
