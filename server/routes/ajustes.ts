import { Router } from "express";
import { db } from "../db.ts";
import { socioConResumen, type SocioRow } from "../queries.ts";
import { leerConfigEmail, guardarConfigEmail, emailConfigurado, leerDatosRecibo, guardarDatosRecibo } from "../config.ts";
import { enviarCorreo } from "../correo.ts";

export const ajustesRouter = Router();

// --- Configuración de correo -------------------------------------------------

// Nunca devolvemos la contraseña; solo si hay una guardada.
ajustesRouter.get("/config/email", (_req, res) => {
  const c = leerConfigEmail();
  res.json({ host: c.host, port: c.port, secure: c.secure, usuario: c.usuario, remitente: c.remitente, tienePass: !!c.pass });
});

ajustesRouter.post("/config/email", (req, res) => {
  const { host, port, secure, usuario, remitente, pass } = req.body ?? {};
  guardarConfigEmail({
    host: host !== undefined ? String(host).trim() : undefined,
    port: port !== undefined ? Number(port) : undefined,
    secure: secure !== undefined ? !!secure : undefined,
    usuario: usuario !== undefined ? String(usuario).trim() : undefined,
    remitente: remitente !== undefined ? String(remitente).trim() : undefined,
    pass: typeof pass === "string" ? pass : undefined, // vacía => no cambia
  });
  res.json({ ok: true });
});

ajustesRouter.post("/config/email/probar", async (_req, res) => {
  if (!emailConfigurado()) return res.status(400).json({ error: "Configura primero el correo." });
  const c = leerConfigEmail();
  try {
    await enviarCorreo(
      c.usuario,
      "Prueba de GymGrecia",
      "Si lees esto, el correo está bien configurado. Ya puedes enviar avisos a los socios."
    );
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: "No se pudo enviar: " + (e?.message ?? e) });
  }
});

// --- Avisos por correo -------------------------------------------------------

function ddmmaaaa(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Manda al socio un recordatorio con sus cuotas atrasadas/sin pagar.
ajustesRouter.post("/avisos/email", async (req, res) => {
  const { socioId } = req.body ?? {};
  if (!socioId) return res.status(400).json({ error: "Falta el socio" });
  if (!emailConfigurado()) return res.status(400).json({ error: "Configura primero el correo en Ajustes." });

  const fila = db.prepare("SELECT * FROM socios WHERE id = ?").get(socioId) as SocioRow | undefined;
  if (!fila) return res.status(404).json({ error: "Socio no encontrado" });
  const socio = socioConResumen(fila);
  if (!socio.email) return res.status(400).json({ error: `${socio.nombreCompleto} no tiene email guardado.` });

  const pendientes = socio.suscripciones.filter((s) => s.activa && (s.estado === "atrasado" || s.estado === "pendiente"));
  if (pendientes.length === 0) return res.status(400).json({ error: `${socio.nombreCompleto} no tiene cuotas atrasadas.` });

  const c = leerConfigEmail();
  const firma = c.remitente || "El gimnasio";
  const lineas = pendientes.map((s) => {
    const act = cap(s.actividad) + (s.etiqueta ? ` (${s.etiqueta})` : "");
    const venc = s.estado === "pendiente" ? "sin pagar todavía" : `venció el ${ddmmaaaa(s.pagadoHasta)}`;
    return `  • ${act}: ${s.importe} € · ${venc}`;
  });
  const texto = `Hola ${socio.nombreCompleto}:\n\nTe recordamos que tienes cuotas pendientes en el gimnasio:\n\n${lineas.join(
    "\n"
  )}\n\nCuando puedas, pásate a ponerlas al día. ¡Gracias!\n\n${firma}`;

  try {
    await enviarCorreo(socio.email, `Recordatorio de cuota · ${firma}`, texto);
    res.json({ ok: true, email: socio.email });
  } catch (e: any) {
    res.status(500).json({ error: "No se pudo enviar: " + (e?.message ?? e) });
  }
});

// --- Datos fiscales para el recibo ------------------------------------------

ajustesRouter.get("/config/datos", (_req, res) => {
  res.json(leerDatosRecibo());
});

ajustesRouter.post("/config/datos", (req, res) => {
  const { nombre, nif, direccion, tipoDoc, iva, ivaTipo, pie } = req.body ?? {};
  guardarDatosRecibo({
    nombre: nombre !== undefined ? String(nombre).trim() : undefined,
    nif: nif !== undefined ? String(nif).trim() : undefined,
    direccion: direccion !== undefined ? String(direccion).trim() : undefined,
    tipoDoc: tipoDoc !== undefined ? String(tipoDoc).trim() || "Recibo" : undefined,
    iva: iva === "incluido" || iva === "exento" || iva === "no" ? iva : undefined,
    ivaTipo: ivaTipo !== undefined ? Math.min(Math.max(Number(ivaTipo) || 0, 0), 99) : undefined,
    pie: pie !== undefined ? String(pie) : undefined,
  });
  res.json({ ok: true });
});
