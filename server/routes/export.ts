import { Router, type Response } from "express";
import { libroSocios, libroSocio } from "../export.ts";

export const exportRouter = Router();

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function enviarXlsx(res: Response, nombre: string, buf: Buffer) {
  res.setHeader("Content-Type", XLSX);
  res.setHeader("Content-Disposition", `attachment; filename="${nombre}"`);
  res.send(buf);
}

// Listado de socios. Sin parámetros = todos; ?ids=1,2,3 = solo esos (export selectivo).
exportRouter.get("/export/socios", async (req, res) => {
  try {
    const idsRaw = String(req.query.ids ?? "").trim();
    const ids = idsRaw
      ? idsRaw
          .split(",")
          .map((x) => Number(x))
          .filter((n) => Number.isInteger(n) && n > 0)
      : undefined;
    const buf = await libroSocios(ids);
    enviarXlsx(res, ids ? "socios-seleccion.xlsx" : "socios-todos.xlsx", buf);
  } catch (e: any) {
    res.status(500).json({ error: "No se pudo exportar: " + (e?.message ?? e) });
  }
});

// Informe detallado de un socio (datos + actividades + pagos con retraso).
exportRouter.get("/export/socio/:id", async (req, res) => {
  try {
    const buf = await libroSocio(Number(req.params.id));
    enviarXlsx(res, `socio-${req.params.id}.xlsx`, buf);
  } catch (e: any) {
    if (String(e?.message).includes("no encontrado")) return res.status(404).json({ error: "Socio no encontrado" });
    res.status(500).json({ error: "No se pudo exportar: " + (e?.message ?? e) });
  }
});
