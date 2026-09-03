import { Router } from "express";
import { db } from "../db.ts";
import { socioConResumen, type SocioRow } from "../queries.ts";
import { leerConfigEmail, guardarConfigEmail, emailConfigurado, leerDatosRecibo, guardarDatosRecibo, leerConfigCopias, guardarConfigCopias } from "../config.ts";
import { enviarCopiaPorEmail, leerEstadoCopiaEmail } from "../copia-email.ts";
import { enviarCorreo } from "../correo.ts";
import { registrarEvento } from "../eventos.ts";
import { cap, ddmmaaaa } from "../texto.ts";

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


// Manda al socio un recordatorio con sus cuotas atrasadas/sin pagar.
ajustesRouter.post("/avisos/email", async (req, res) => {
  const { socioId } = req.body ?? {};
  if (!socioId) return res.status(400).json({ error: "Falta el socio" });
  if (!emailConfigurado()) return res.status(400).json({ error: "Configura primero el correo en Ajustes." });

  const fila = db.prepare("SELECT * FROM socios WHERE id = ?").get(socioId) as SocioRow | undefined;
  if (!fila) return res.status(404).json({ error: "Socio no encontrado" });
  const socio = socioConResumen(fila);
  if (!socio.email) return res.status(400).json({ error: `${socio.nombreCompleto} no tiene email guardado.` });
  if (socio.estado === "baja") return res.status(400).json({ error: `${socio.nombreCompleto} está de baja: reactívalo antes de avisarle.` });

  const pendientes = socio.suscripciones.filter((s) => s.activa && (s.estado === "atrasado" || s.estado === "pendiente"));
  if (pendientes.length === 0) return res.status(400).json({ error: `${socio.nombreCompleto} no tiene cuotas atrasadas ni bonos agotados.` });
  const soloBonos = pendientes.every((s) => s.esBono);

  const c = leerConfigEmail();
  const firma = c.remitente || "El gimnasio";
  const lineas = pendientes.map((s) => {
    const act = cap(s.actividad) + (s.etiqueta ? ` (${s.etiqueta})` : "");
    const venc = s.esBono
      ? s.estado === "pendiente"
        ? "bono sin pagar todavía"
        : `bono agotado (${s.sesiones && s.sesiones.restantes < 0 ? `debe ${-s.sesiones.restantes} ${-s.sesiones.restantes === 1 ? "sesión" : "sesiones"}` : "sin sesiones"})`
      : s.estado === "pendiente"
        ? "sin pagar todavía"
        : `venció el ${ddmmaaaa(s.pagadoHasta)}`;
    return `  • ${act}: ${s.importe} € · ${venc}`;
  });
  const texto = `Hola ${socio.nombreCompleto}:\n\nTe recordamos que ${soloBonos ? "tienes el bono pendiente de renovar" : "tienes cuotas pendientes"} en el gimnasio:\n\n${lineas.join(
    "\n"
  )}\n\nCuando puedas, pásate a ${soloBonos ? "renovarlo" : "ponerlas al día"}. ¡Gracias!\n\n${firma}`;

  try {
    await enviarCorreo(socio.email, `${soloBonos ? "Recordatorio de bono" : "Recordatorio de cuota"} · ${firma}`, texto);
    registrarEvento(socio.id, "aviso", `Aviso de cuotas pendientes enviado por email a ${socio.email} (${pendientes.length} cuota${pendientes.length === 1 ? "" : "s"})`);
    res.json({ ok: true, email: socio.email });
  } catch (e: any) {
    res.status(500).json({ error: "No se pudo enviar: " + (e?.message ?? e) });
  }
});

// --- Copia de seguridad por email --------------------------------------------

ajustesRouter.get("/config/copias", (_req, res) => {
  const c = leerConfigCopias();
  const e = leerEstadoCopiaEmail();
  res.json({
    email: c.email,
    activo: c.activo,
    ultimoEnvio: e.ultimoEnvio,
    ultimoIntento: e.ultimoIntento,
    ultimoError: e.ultimoError,
    ultimoMotivo: e.ultimoMotivo,
    correoConfigurado: emailConfigurado(),
  });
});

ajustesRouter.post("/config/copias", (req, res) => {
  const { email, activo } = req.body ?? {};
  const dest = email !== undefined ? String(email).trim() : undefined;
  if (dest !== undefined && dest && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dest)) return res.status(400).json({ error: "Ese correo no parece válido" });
  guardarConfigCopias({ email: dest, activo: activo !== undefined ? !!activo : undefined });
  res.json({ ok: true });
});

// Envío manual (siempre envía, aunque no haya cambios): sirve de prueba real.
ajustesRouter.post("/config/copias/enviar", async (_req, res) => {
  const r = await enviarCopiaPorEmail("manual", { forzar: true });
  if (r.enviado) return res.json(r);
  const msg =
    r.porQueNo === "correo-no-configurado"
      ? "Configura primero el correo de envío (arriba) y guárdalo."
      : r.porQueNo === "sin-destinatario"
        ? "Indica el correo que recibirá las copias."
        : r.error || "No se pudo enviar.";
  res.status(400).json({ error: msg, ...r });
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
