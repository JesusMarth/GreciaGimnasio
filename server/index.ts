import express from "express";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import "./db.ts"; // inicializa el esquema al arrancar
import { sociosRouter } from "./routes/socios.ts";
import { suscripcionesRouter } from "./routes/suscripciones.ts";
import { pagosRouter } from "./routes/pagos.ts";
import { tarifasRouter } from "./routes/tarifas.ts";
import { dashboardRouter } from "./routes/dashboard.ts";
import { metricasRouter } from "./routes/metricas.ts";
import { backupsRouter } from "./routes/backups.ts";
import { ajustesRouter } from "./routes/ajustes.ts";
import { exportRouter } from "./routes/export.ts";
import { asistenciasRouter } from "./routes/asistencias.ts";
import { crearCopia, enCola } from "./copias.ts";
import { enviarCopiaConTope, enviarCopiaPorEmail, faltaEnvioDeHoy } from "./copia-email.ts";

const app = express();
app.use(express.json());

app.use("/api/socios", sociosRouter);
app.use("/api/tarifas", tarifasRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api", metricasRouter); // /metricas, /gastos
app.use("/api/pagos", pagosRouter);
app.use("/api", suscripcionesRouter); // /socios/:id/suscripciones y /suscripciones/:id
app.use("/api", backupsRouter); // /backups, /backup, /backup/restaurar
app.use("/api", ajustesRouter); // /config/email, /avisos/email
app.use("/api", exportRouter); // /export/socios, /export/socio/:id
app.use("/api", asistenciasRouter); // /suscripciones/:id/asistencias, /asistencias/:id

app.get("/api/salud", (_req, res) => res.json({ ok: true }));

// Solo en pruebas (GYM_PRUEBAS=1): cierra la app como si se apagara, para poder
// comprobar por API que el cierre envía la copia por email (en Windows no se puede
// mandar una señal a un proceso hijo).
if (process.env.GYM_PRUEBAS) {
  app.post("/api/_cerrar", (_req, res) => {
    res.json({ ok: true });
    setTimeout(() => void alCerrar(), 50);
  });
}

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
  // Copia por EMAIL: red de seguridad al arrancar si hoy aún no se ha enviado (el
  // cierre anterior pudo ser brusco o sin internet), y una comprobación cada hora
  // por si la app se queda abierta varios días. El envío principal es al cerrar.
  setTimeout(() => {
    if (faltaEnvioDeHoy()) void enviarCopiaPorEmail("arranque");
  }, 8000).unref();
  setInterval(() => {
    if (faltaEnvioDeHoy()) void enviarCopiaPorEmail("diario");
  }, 60 * 60 * 1000).unref();
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
  // Copia por email al apagar (cada día, cada vez que se cierra, si hay cambios).
  // Con tope: al cerrar la ventana, Windows mata el proceso a los ~10 s.
  try {
    const r = await enviarCopiaConTope("cierre", 8500);
    if (r.enviado) console.log(`  Copia de seguridad enviada por email a ${r.para}.`);
    else if (r.porQueNo === "error") console.error(`  No se pudo enviar la copia por email: ${r.error}`);
  } catch {
    /* ya queda apuntado en la config; al arrancar se reintenta */
  }
  process.exit(0);
}
process.on("SIGINT", alCerrar);
process.on("SIGTERM", alCerrar);
process.on("SIGHUP", alCerrar); // Windows: al cerrar la ventana de la consola
