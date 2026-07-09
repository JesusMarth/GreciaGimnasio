// Historial de movimientos por socio: cada operación de interés (cobros, borrados,
// altas, bajas, avisos…) deja una línea con fecha y hora. Sirve para responder
// "¿qué pasó con este socio?" cuando algo no cuadra.
import { db } from "./db.ts";

/** Ahora mismo en hora local, como "YYYY-MM-DD HH:MM". */
export function ahoraISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16).replace("T", " ");
}

/**
 * Apunta un movimiento en el historial del socio. Nunca lanza: el historial es
 * un extra y no debe romper jamás la operación principal (el cobro, el borrado…).
 * Se guarda también el nombre por si el socio se borra después (el evento queda).
 */
export function registrarEvento(socioId: number | string, tipo: string, detalle: string) {
  try {
    const s = db
      .prepare("SELECT nombre || CASE WHEN COALESCE(apellidos,'') <> '' THEN ' ' || apellidos ELSE '' END AS n FROM socios WHERE id = ?")
      .get(socioId) as { n: string } | undefined;
    db.prepare("INSERT INTO eventos (socio_id, socio_nombre, fecha, tipo, detalle) VALUES (?,?,?,?,?)").run(
      socioId,
      s?.n ?? null,
      ahoraISO(),
      tipo,
      detalle
    );
  } catch {
    /* sin historial antes que sin cobro */
  }
}
