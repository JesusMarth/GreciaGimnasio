import { db } from "./db.ts";

// Configuración de correo para los avisos. Se guarda en la tabla `config` (claves
// con prefijo "email."), así que viaja con /data al copiar a otro equipo.
export interface ConfigEmail {
  host: string; // p. ej. smtp.gmail.com
  port: number; // 465 (SSL) o 587 (STARTTLS)
  secure: boolean; // true para el puerto 465
  usuario: string; // dirección desde la que se envía
  pass: string; // contraseña de aplicación (NO la del correo normal)
  remitente: string; // nombre visible, p. ej. "Gimnasio Grecia"
}

export function leerConfigEmail(): ConfigEmail {
  const filas = db.prepare("SELECT clave, valor FROM config WHERE clave LIKE 'email.%'").all() as {
    clave: string;
    valor: string;
  }[];
  const m = new Map(filas.map((f) => [f.clave, f.valor]));
  return {
    host: m.get("email.host") ?? "",
    port: Number(m.get("email.port") ?? 465),
    secure: (m.get("email.secure") ?? "1") === "1",
    usuario: m.get("email.usuario") ?? "",
    pass: m.get("email.pass") ?? "",
    remitente: m.get("email.remitente") ?? "",
  };
}

/** Guarda solo los campos presentes. Una `pass` vacía NO sobreescribe la guardada. */
export function guardarConfigEmail(cfg: Partial<ConfigEmail>) {
  const up = db.prepare(
    "INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor"
  );
  const tx = db.transaction(() => {
    if (cfg.host !== undefined) up.run("email.host", cfg.host);
    if (cfg.port !== undefined) up.run("email.port", String(cfg.port));
    if (cfg.secure !== undefined) up.run("email.secure", cfg.secure ? "1" : "0");
    if (cfg.usuario !== undefined) up.run("email.usuario", cfg.usuario);
    if (cfg.remitente !== undefined) up.run("email.remitente", cfg.remitente);
    if (cfg.pass) up.run("email.pass", cfg.pass); // solo si llega no vacía
  });
  tx();
}

export function emailConfigurado(): boolean {
  const c = leerConfigEmail();
  return !!(c.host && c.usuario && c.pass);
}

// Datos fiscales que aparecen en el recibo/factura. También en la tabla `config`
// (claves "datos.*"), así que viajan con /data.
export interface DatosRecibo {
  nombre: string; // razón social o nombre comercial
  nif: string;
  direccion: string;
  tipoDoc: string; // título del documento: "Recibo" | "Factura" | …
  iva: "no" | "incluido" | "exento"; // cómo tratar el IVA en el documento
  ivaTipo: number; // % de IVA cuando iva === "incluido"
  pie: string; // texto libre al pie
}

export function leerDatosRecibo(): DatosRecibo {
  const filas = db.prepare("SELECT clave, valor FROM config WHERE clave LIKE 'datos.%'").all() as {
    clave: string;
    valor: string;
  }[];
  const m = new Map(filas.map((f) => [f.clave, f.valor]));
  const iva = m.get("datos.iva");
  return {
    nombre: m.get("datos.nombre") ?? "",
    nif: m.get("datos.nif") ?? "",
    direccion: m.get("datos.direccion") ?? "",
    tipoDoc: m.get("datos.tipoDoc") ?? "Recibo",
    iva: iva === "incluido" || iva === "exento" ? iva : "no",
    ivaTipo: Number(m.get("datos.ivaTipo") ?? 21),
    pie: m.get("datos.pie") ?? "",
  };
}

export function guardarDatosRecibo(d: Partial<DatosRecibo>) {
  const up = db.prepare(
    "INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor"
  );
  const tx = db.transaction(() => {
    if (d.nombre !== undefined) up.run("datos.nombre", d.nombre);
    if (d.nif !== undefined) up.run("datos.nif", d.nif);
    if (d.direccion !== undefined) up.run("datos.direccion", d.direccion);
    if (d.tipoDoc !== undefined) up.run("datos.tipoDoc", d.tipoDoc);
    if (d.iva !== undefined) up.run("datos.iva", d.iva);
    if (d.ivaTipo !== undefined) up.run("datos.ivaTipo", String(d.ivaTipo));
    if (d.pie !== undefined) up.run("datos.pie", d.pie);
  });
  tx();
}
