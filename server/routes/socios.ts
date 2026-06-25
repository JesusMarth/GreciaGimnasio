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
  if (buscar) {
    const like = `%${buscar}%`;
    filas = db
      .prepare("SELECT * FROM socios WHERE nombre LIKE ? OR telefono LIKE ? OR email LIKE ? ORDER BY nombre")
      .all(like, like, like) as SocioRow[];
  } else {
    filas = db.prepare("SELECT * FROM socios ORDER BY nombre").all() as SocioRow[];
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
  const { nombre, telefono, email, dni, fechaAlta, fechaNacimiento, notas } = req.body ?? {};
  if (!nombre || !String(nombre).trim()) return res.status(400).json({ error: "El nombre es obligatorio" });
  const info = db
    .prepare(
      `INSERT INTO socios (nombre, telefono, email, dni, fecha_alta, fecha_nacimiento, estado, notas, creado_en)
       VALUES (?,?,?,?,?,?,?,?,?)`
    )
    .run(
      String(nombre).trim(),
      telefono || null,
      email || null,
      dni || null,
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
  const { nombre, telefono, email, dni, fechaAlta, fechaNacimiento, estado, notas } = req.body ?? {};
  db.prepare(
    `UPDATE socios SET nombre=?, telefono=?, email=?, dni=?, fecha_alta=?, fecha_nacimiento=?, estado=?, notas=? WHERE id=?`
  ).run(
    nombre?.trim() || s.nombre,
    telefono ?? s.telefono,
    email ?? s.email,
    dni ?? s.dni,
    fechaAlta || s.fecha_alta,
    fechaNacimiento ?? s.fecha_nacimiento,
    estado === "activo" || estado === "baja" ? estado : s.estado,
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
