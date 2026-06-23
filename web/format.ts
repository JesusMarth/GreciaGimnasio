import type { EstadoCuota } from "./types.ts";

export function euros(n: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n ?? 0);
}

/** "2026-06-23" -> "23/06/2026". Vacio si no hay fecha. */
export function fecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Hoy en formato ISO local "YYYY-MM-DD". */
export function hoyISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

export const ESTADO_LABEL: Record<EstadoCuota, string> = {
  aldia: "Al día",
  pronto: "Vence pronto",
  atrasado: "Atrasado",
  pendiente: "Sin pagar",
};

/** Texto humano del estado segun dias restantes. */
export function estadoTexto(estado: EstadoCuota, dias: number | null): string {
  if (estado === "pendiente") return "Sin pagar todavía";
  if (estado === "atrasado") return `Atrasado ${Math.abs(dias ?? 0)} día${Math.abs(dias ?? 0) === 1 ? "" : "s"}`;
  if (estado === "pronto") {
    if (dias === 0) return "Vence hoy";
    return `Vence en ${dias} día${dias === 1 ? "" : "s"}`;
  }
  return `Al día · quedan ${dias} días`;
}

export function capitalizar(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Color semantico de un estado (clase CSS: rojo/ambar/verde/gris). */
export function colorEstado(e: EstadoCuota | null): "rojo" | "ambar" | "verde" | "gris" {
  if (e === "atrasado" || e === "pendiente") return "rojo";
  if (e === "pronto") return "ambar";
  if (e === "aldia") return "verde";
  return "gris";
}
