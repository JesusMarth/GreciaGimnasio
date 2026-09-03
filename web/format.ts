import type { EstadoCuota } from "./types.ts";

export function euros(n: number): string {
  const v = Number(n);
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number.isFinite(v) ? v : 0);
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

/** Qué significa cada estado de cuota (para tooltips y ayuda). */
export const EXPLICA_ESTADO: Record<EstadoCuota, string> = {
  pendiente: "Nunca ha pagado esta cuota (socio nuevo o aún sin cobrar).",
  atrasado: "Pagó antes, pero su cuota ya venció. Toca renovar.",
  pronto: "Su cuota vence en 5 días o menos.",
  aldia: "Cuota pagada y al corriente.",
};

/** Etiquetas del estado cuando la cuota es un bono por sesiones (no caduca: se agota). */
export const ESTADO_LABEL_BONO: Record<EstadoCuota, string> = {
  aldia: "Con sesiones",
  pronto: "Quedan pocas",
  atrasado: "Agotado",
  pendiente: "Sin bono",
};

export const EXPLICA_ESTADO_BONO: Record<EstadoCuota, string> = {
  pendiente: "Nunca ha comprado este bono (ni trae sesiones apuntadas).",
  atrasado: "Se le acabaron las sesiones del bono. Toca cobrarle uno nuevo.",
  pronto: "Le quedan 3 sesiones o menos.",
  aldia: "Tiene sesiones de sobra en el bono.",
};

/**
 * Texto humano del estado segun dias restantes. Si `sesiones` viene (bono por
 * sesiones), el texto habla de sesiones en vez de días.
 */
export function estadoTexto(estado: EstadoCuota, dias: number | null, sesiones?: number | null): string {
  if (sesiones !== undefined && sesiones !== null) {
    if (estado === "pendiente") return "Sin bono todavía";
    if (sesiones < 0) return `Agotado · debe ${-sesiones} ${-sesiones === 1 ? "sesión" : "sesiones"}`;
    if (sesiones === 0) return "Bono agotado";
    return `Quedan ${sesiones} ${sesiones === 1 ? "sesión" : "sesiones"}`;
  }
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

/** Dispara la descarga de una URL (p. ej. un .xlsx que el servidor sirve como adjunto). */
export function descargar(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Color semantico de un estado (clase CSS: rojo/ambar/verde/gris). */
export function colorEstado(e: EstadoCuota | null): "rojo" | "morado" | "ambar" | "verde" | "gris" {
  if (e === "atrasado") return "rojo";
  if (e === "pendiente") return "morado"; // sin pagar (nunca pagó) — distinto del atrasado
  if (e === "pronto") return "ambar";
  if (e === "aldia") return "verde";
  return "gris";
}
