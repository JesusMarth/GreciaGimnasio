import { Router } from "express";
import { db } from "../db.ts";
import { hoyISO } from "../util.ts";
import { socioConResumen, type SocioRow } from "../queries.ts";

export const sociosRouter = Router();

// Lista de socios (con busqueda opcional) + estado-resumen de cada uno.
sociosRouter.get("/", (req, res) => {
  const buscar = String(req.query.buscar ?? "").trim();
  const hoy = hoyISO();
  let filas: SocioRow[];
  const ORDEN = "ORDER BY apellidos COLLATE NOCASE, nombre COLLATE NOCASE";
  if (buscar) {
    const like = `%${buscar}%`;
    filas = db
      .prepare(`SELECT * FROM socios WHERE nombre LIKE ? OR apellidos LIKE ? OR telefono LIKE ? OR email LIKE ? ${ORDEN}`)
      .all(like, like, like, like) as SocioRow[];
  } else {
    filas = db.prepare(`SELECT * FROM socios ${ORDEN}`).all() as SocioRow[];
  }
  res.json(filas.map((s) => socioConResumen(s, hoy)));
});

// Ficha de un socio.
sociosRouter.get("/:id", (req, res) => {
  const s = db.prepare("SELECT * FROM socios WHERE id = ?").get(req.params.id) as SocioRow | undefined;
  if (!s) return res.status(404).json({ error: "Socio no encontrado" });
  res.json(socioConResumen(s));
});

// Alta de socio.
sociosRouter.post("/", (req, res) => {
  const { nombre, apellidos, telefono, email, dni, sexo, fechaAlta, fechaNacimiento, notas } = req.body ?? {};
  if (!nombre || !String(nombre).trim()) return res.status(400).json({ error: "El nombre es obligatorio" });
  const sexoVal = sexo === "hombre" || sexo === "mujer" ? sexo : null;
  const info = db
    .prepare(
      `INSERT INTO socios (nombre, apellidos, telefono, email, dni, sexo, fecha_alta, fecha_nacimiento, estado, notas, creado_en)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      String(nombre).trim(),
      apellidos && String(apellidos).trim() ? String(apellidos).trim() : null,
      telefono || null,
      email || null,
      dni || null,
      sexoVal,
      fechaAlta || hoyISO(),
      fechaNacimiento || null,
      "activo",
      notas || null,
      hoyISO()
    );
  const s = db.prepare("SELECT * FROM socios WHERE id = ?").get(info.lastInsertRowid) as SocioRow;
  res.status(201).json(socioConResumen(s));
});

// Editar socio (datos personales y estado activo/baja).
sociosRouter.put("/:id", (req, res) => {
  const s = db.prepare("SELECT * FROM socios WHERE id = ?").get(req.params.id) as SocioRow | undefined;
  if (!s) return res.status(404).json({ error: "Socio no encontrado" });
  const { nombre, apellidos, telefono, email, dni, sexo, fechaAlta, fechaNacimiento, estado, notas } = req.body ?? {};
  // sexo: si no viene en la petición, se conserva; si viene, se valida (vacío → null).
  const sexoVal = sexo === undefined ? s.sexo : sexo === "hombre" || sexo === "mujer" ? sexo : null;
  // apellidos: si no viene, se conserva; si viene vacío, se pone a null.
  const apellidosVal = apellidos === undefined ? s.apellidos : String(apellidos).trim() || null;
  const nuevoEstado = estado === "activo" || estado === "baja" ? estado : s.estado;
  // fecha_baja: se apunta al dar de baja (si no la tenía ya) y se limpia al
  // reactivar. Alimenta "bajas por mes" en Métricas.
  const fechaBaja = nuevoEstado === "baja" ? (s.estado === "baja" ? s.fecha_baja : hoyISO()) : null;
  db.prepare(
    `UPDATE socios SET nombre=?, apellidos=?, telefono=?, email=?, dni=?, sexo=?, fecha_alta=?, fecha_nacimiento=?, estado=?, fecha_baja=?, notas=? WHERE id=?`
  ).run(
    nombre?.trim() || s.nombre,
    apellidosVal,
    telefono ?? s.telefono,
    email ?? s.email,
    dni ?? s.dni,
    sexoVal,
    fechaAlta || s.fecha_alta,
    fechaNacimiento ?? s.fecha_nacimiento,
    nuevoEstado,
    fechaBaja,
    notas ?? s.notas,
    s.id
  );
  const actualizado = db.prepare("SELECT * FROM socios WHERE id = ?").get(s.id) as SocioRow;
  res.json(socioConResumen(actualizado));
});

// Borrar socio (arrastra suscripciones y pagos por las FK en cascada).
sociosRouter.delete("/:id", (req, res) => {
  const info = db.prepare("DELETE FROM socios WHERE id = ?").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Socio no encontrado" });
  res.json({ ok: true });
});
