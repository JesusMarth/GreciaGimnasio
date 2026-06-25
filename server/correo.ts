import nodemailer from "nodemailer";
import { leerConfigEmail } from "./config.ts";

export interface Adjunto {
  filename: string;
  content: Buffer;
}

/** Envía un correo (texto, con adjuntos opcionales) usando la config SMTP guardada. */
export async function enviarCorreo(para: string, asunto: string, texto: string, adjuntos?: Adjunto[]) {
  const c = leerConfigEmail();
  if (!c.host || !c.usuario || !c.pass) {
    throw new Error("El correo no está configurado. Ve a Ajustes.");
  }
  const transporte = nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    auth: { user: c.usuario, pass: c.pass },
  });
  await transporte.sendMail({
    from: c.remitente ? `"${c.remitente}" <${c.usuario}>` : c.usuario,
    to: para,
    subject: asunto,
    text: texto,
    attachments: adjuntos,
  });
}
