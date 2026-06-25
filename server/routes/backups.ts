import { Router } from "express";
import { DB_PATH, BACKUPS_DIR, restaurarBaseDeDatos } from "../db.ts";
import { crearCopia, listarCopias, rutaDeCopia, enCola } from "../copias.ts";

export const backupsRouter = Router();

// Estado de las copias + rutas reales (para que el usuario sepa qué carpeta llevarse).
backupsRouter.get("/backups", (_req, res) => {
  res.json({ dbPath: DB_PATH, carpeta: BACKUPS_DIR, copias: listarCopias() });
});

// Copia manual (botón "Hacer copia ahora").
backupsRouter.post("/backup", async (_req, res) => {
  try {
    res.status(201).json(await enCola(() => crearCopia("manual")));
  } catch (e: any) {
    res.status(500).json({ error: "No se pudo crear la copia: " + (e?.message ?? e) });
  }
});

// Restaurar: pisa TODOS los datos con los de una copia. Antes guarda una red de
// seguridad ("pre-restore") por si el usuario se arrepiente.
backupsRouter.post("/backup/restaurar", async (req, res) => {
  const { archivo } = req.body ?? {};
  if (!archivo) return res.status(400).json({ error: "Falta el archivo de copia" });
  const ruta = rutaDeCopia(String(archivo));
  if (!ruta) return res.status(404).json({ error: "Copia no encontrada" });
  try {
    await enCola(async () => {
      await crearCopia("pre-restore");
      await restaurarBaseDeDatos(ruta);
    });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: "No se pudo restaurar: " + (e?.message ?? e) });
  }
});
