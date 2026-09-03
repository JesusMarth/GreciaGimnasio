// Formateo de textos compartido por rutas, recibo, export y eventos. Antes cada
// archivo tenía su propia copia de estas mini-funciones (con pequeñas
// divergencias); aquí viven una sola vez.

/** "gimnasio" → "Gimnasio". */
export const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** "2026-06-23" → "23/06/2026"; sin fecha → "—". */
export function ddmmaaaa(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Importe con dos decimales, para recibos: 60 → "60,00 €". */
export const eur = (n: number): string => n.toFixed(2).replace(".", ",") + " €";

/** Importe corto, para textos del historial: 60 → "60 €", 32.5 → "32,5 €". */
export const eurCorto = (n: number): string => `${(Math.round(n * 100) / 100).toString().replace(".", ",")} €`;

/** Fecha ISO "YYYY-MM-DD" (validación de entrada). */
export const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Métodos de cobro admitidos (el primero es el valor por defecto). */
export const METODOS: string[] = ["efectivo", "transferencia", "bizum", "tarjeta"];
export const metodoValido = (m: unknown): string => (METODOS.includes(String(m)) ? String(m) : METODOS[0]);

/** Etiqueta humana de cada estado de cuota (misma que la web, para Excel/emails). */
export const ESTADO_TXT: Record<string, string> = {
  aldia: "Al día",
  pronto: "Vence pronto",
  atrasado: "Atrasado",
  pendiente: "Sin pagar",
};

/** Lo mismo para bonos por sesiones (no caducan: se agotan). */
export const ESTADO_TXT_BONO: Record<string, string> = {
  aldia: "Con sesiones",
  pronto: "Quedan pocas",
  atrasado: "Agotado",
  pendiente: "Sin bono",
};

/** Duración de una cuota por tiempo: 1 → "Mensual", 3 → "Trimestral", 6 → "Semestral", 12 → "Anual". */
export const duracionTxt = (meses: number): string =>
  meses === 12 ? "Anual" : meses === 6 ? "Semestral" : meses === 3 ? "Trimestral" : meses === 1 ? "Mensual" : `Cada ${meses} meses`;

/** Etiqueta de estado según sea cuota por fecha o bono por sesiones. */
export const estadoTxt = (estado: string | null, bono: boolean): string =>
  estado ? ((bono ? ESTADO_TXT_BONO : ESTADO_TXT)[estado] ?? estado) : "Sin cuotas";
