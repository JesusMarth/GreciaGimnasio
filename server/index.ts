import express from "express";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import "./db.ts"; // inicializa el esquema al arrancar
import { sociosRouter } from "./routes/socios.ts";
import { suscripcionesRouter } from "./routes/suscripciones.ts";
import { pagosRouter } from "./routes/pagos.ts";
import { tarifasRouter } from "./routes/tarifas.ts";
import { dashboardRouter } from "./routes/dashboard.ts";
import { backupsRouter } from "./routes/backups.ts";
import { ajustesRouter } from "./routes/ajustes.ts";
import { exportRouter } from "./routes/export.ts";
import { crearCopia, enCola } from "./copias.ts";

const app = express();
app.use(express.json());

app.use("/api/socios", sociosRouter);
app.use("/api/tarifas", tarifasRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/pagos", pagosRouter);
app.use("/api", suscripcionesRouter); // /socios/:id/suscripciones y /suscripciones/:id
app.use("/api", backupsRouter); // /backups, /backup, /backup/restaurar
app.use("/api", ajustesRouter); // /config/email, /avisos/email
app.use("/api", exportRouter); // /export/socios, /export/socio/:id

app.get("/api/salud", (_req, res) => res.json({ ok: true }));

// En produccion (tras "npm run build") servimos la web compilada desde /dist.
const distDir = resolve(import.meta.dirname, "..", "dist");
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(resolve(distDir, "index.html"));
  });
}

// Manejador de errores final.
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});

// Puerto fijo del backend. Ignoramos process.env.PORT a proposito: en el entorno
// de preview esa variable trae el puerto del frontend (Vite) y provocaria un choque
// de puertos. El proxy de Vite (vite.config.ts) apunta a este mismo 4711.
const PORT = Number(process.env.GYM_API_PORT) || 4711;
const servidor = app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n  GymGrecia funcionando en  ${url}\n`);
  // Red de seguridad fiable: una copia automática nada más arrancar (captura el
  // estado de la última sesión aunque el cierre anterior fuese brusco).
  void enCola(() => crearCopia("auto")).catch(() => {});
  // En modo "app de escritorio" (web ya compilada) abrimos el navegador solo.
  // GYM_NO_OPEN=1 lo desactiva (util en pruebas / cuando ya esta abierto).
  if (existsSync(distDir) && !process.env.GYM_NO_OPEN) {
    import("node:child_process").then(({ exec }) => exec(`start "" ${url}`));
  }
});
servidor.on("error", (e: NodeJS.ErrnoException) => {
  if (e.code === "EADDRINUSE") console.error(`\n  El puerto ${PORT} ya está en uso. Cierra la otra instancia y reinicia.\n`);
  else console.error(e);
});

// Copia de seguridad automática al cerrar (best-effort: en Windows el cierre brusco
// de la ventana puede no dar tiempo, por eso también copiamos al arrancar).
let cerrando = false;
async function alCerrar() {
  if (cerrando) return;
  cerrando = true;
  try {
    await enCola(() => crearCopia("auto"));
  } catch {
    /* nada que hacer al salir */
  }
  process.exit(0);
}
process.on("SIGINT", alCerrar);
process.on("SIGTERM", alCerrar);
