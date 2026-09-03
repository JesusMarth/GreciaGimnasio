import { Router } from "express";
import { db } from "../db.ts";
import { hoyISO } from "../util.ts";
import { ahoraISO, registrarEvento } from "../eventos.ts";
import { cap, ddmmaaaa as ddmm, ISO } from "../texto.ts";
import { esBonoPorSesiones, sesionesDe, suscripcionConEstado, type SuscripcionRow } from "../queries.ts";

// Asistencias = "picar un punto del papelito". Cada sesión picada es una fila;
// las sesiones restantes del bono se CALCULAN (compradas + manual − picadas), así
// que deshacer una sesión es borrar su fila y todo cuadra solo.
export const asistenciasRouter = Router();


function bonoDe(id: string | number): SuscripcionRow | null {
  const s = db.prepare("SELECT * FROM suscripciones WHERE id = ?").get(id) as SuscripcionRow | undefined;
  return s && esBonoPorSesiones(s) ? s : null;
}

// Sesiones picadas de un bono (las más recientes primero).
asistenciasRouter.get("/suscripciones/:id/asistencias", (req, res) => {
  const s = bonoDe(req.params.id);
  if (!s) return res.status(404).json({ error: "Bono no encontrado" });
  const filas = db
    .prepare("SELECT id, fecha, creado_en, notas FROM asistencias WHERE suscripcion_id = ? ORDER BY fecha DESC, id DESC")
    .all(s.id) as { id: number; fecha: string; creado_en: string; notas: string | null }[];
  res.json(filas.map((a) => ({ id: a.id, fecha: a.fecha, creadoEn: a.creado_en, notas: a.notas })));
});

// Picar una sesión. `fecha` opcional (por defecto hoy) para apuntar visitas de
// días anteriores (p. ej. al pasar a la app un bono que ya estaba en uso).
// Se permite picar con el bono agotado (queda en negativo = "debe sesiones"):
// el mostrador decide si le deja entrar; la app solo lo deja claro.
asistenciasRouter.post("/suscripciones/:id/asistencias", (req, res) => {
  const s = bonoDe(req.params.id);
  if (!s) return res.status(404).json({ error: "Este bono no se lleva por sesiones (edítalo e indica sus sesiones)" });
  if (!s.activa) return res.status(400).json({ error: "El bono está pausado; reactívalo antes de picar" });
  const socio = db.prepare("SELECT estado FROM socios WHERE id = ?").get(s.socio_id) as { estado: string } | undefined;
  if (socio?.estado === "baja") return res.status(400).json({ error: "El socio está de baja; reactívalo antes de picar" });
  const { fecha, notas } = req.body ?? {};
  const hoy = hoyISO();
  const f = fecha ? String(fecha) : hoy;
  if (!ISO.test(f)) return res.status(400).json({ error: "Fecha no válida" });
  if (f > hoy) return res.status(400).json({ error: "No se puede picar una sesión con fecha futura" });
  const info = db
    .prepare("INSERT INTO asistencias (suscripcion_id, socio_id, fecha, creado_en, notas) VALUES (?,?,?,?,?)")
    .run(s.id, s.socio_id, f, ahoraISO(), notas ? String(notas) : null);
  const ses = sesionesDe(s);
  registrarEvento(
    s.socio_id,
    "asistencia",
    `Sesión picada del bono de ${cap(s.actividad)}${f === hoy ? "" : ` (del ${ddmm(f)})`}: quedan ${ses.restantes} de ${ses.compradas + ses.manual}` +
      (ses.restantes < 0 ? " — bono agotado, entra a deber" : "")
  );
  res.status(201).json({ id: info.lastInsertRowid, suscripcion: suscripcionConEstado(s, hoy) });
});

// Deshacer una sesión picada (por error, o para corregir). Queda en el historial.
asistenciasRouter.delete("/asistencias/:id", (req, res) => {
  const a = db.prepare("SELECT * FROM asistencias WHERE id = ?").get(req.params.id) as
    | { id: number; suscripcion_id: number; socio_id: number; fecha: string; creado_en: string }
    | undefined;
  if (!a) return res.status(404).json({ error: "Sesión no encontrada" });
  db.prepare("DELETE FROM asistencias WHERE id = ?").run(a.id);
  const s = db.prepare("SELECT * FROM suscripciones WHERE id = ?").get(a.suscripcion_id) as SuscripcionRow | undefined;
  if (s) {
    const ses = sesionesDe(s);
    registrarEvento(
      a.socio_id,
      "asistencia_deshecha",
      `Se deshizo la sesión picada del ${ddmm(a.fecha)} (${a.creado_en.slice(11) || "sin hora"}) del bono de ${cap(s.actividad)}: vuelven a quedar ${ses.restantes}`
    );
  }
  res.json({ ok: true, suscripcion: s ? suscripcionConEstado(s, hoyISO()) : null });
});
