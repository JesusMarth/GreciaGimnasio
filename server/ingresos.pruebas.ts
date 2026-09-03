// Pruebas de las casuísticas de INGRESOS vs. estado de cuota (npm run test:ingresos).
// Levanta un servidor real en un puerto/carpeta temporales (no toca datos de nadie),
// ejerce la API igual que la web y comprueba que:
//  - la cobertura "apuntada a mano" del alta NO genera ingresos (a propósito) y queda marcada;
//  - el cobro inicial del alta ("Cobrar ahora") SÍ genera un pago real;
//  - no hay duplicidad: cada euro de Ingresos corresponde a un pago registrado;
//  - borrar un pago restaura la cobertura manual del alta (no deja al socio "Sin pagar").
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { addMeses, hoyISO } from "./util.ts";

const PORT = 4799;
const API = `http://localhost:${PORT}/api`;
const DATA = mkdtempSync(join(tmpdir(), "gymgrecia-prueba-"));

const servidor = spawn(process.execPath, ["--import", "tsx", resolve(import.meta.dirname, "index.ts")], {
  env: { ...process.env, GYM_DATA_DIR: DATA, GYM_API_PORT: String(PORT), GYM_NO_OPEN: "1" },
  stdio: "ignore",
});

async function esperarServidor() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(API + "/salud");
      if (r.ok) return;
    } catch {
      /* aún arrancando */
    }
    await new Promise((ok) => setTimeout(ok, 250));
  }
  throw new Error("El servidor de pruebas no arrancó en el puerto " + PORT);
}

const j = (r: Response) => r.json();
const GET = (p: string) => fetch(API + p).then(j);
const POST = (p: string, body: unknown) =>
  fetch(API + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(j);
const PUT = (p: string, body: unknown) =>
  fetch(API + p, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(j);
const DEL = (p: string) => fetch(API + p, { method: "DELETE" }).then(j);

let fallos = 0;
let total = 0;
function check(nombre: string, real: unknown, esperado: unknown) {
  total++;
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (!ok) {
    fallos++;
    console.error(`✗ ${nombre}\n    real: ${JSON.stringify(real)} · esperado: ${JSON.stringify(esperado)}`);
  }
}

async function ingresosMes(): Promise<number> {
  return (await GET("/dashboard")).ingresosMes.total;
}

async function main() {
  await esperarServidor();
  const hoy = hoyISO();
  const mes = hoy.slice(0, 7);

  // A) Alta sin nada → "Sin pagar", 0 ingresos.
  const a = await POST("/socios", { nombre: "Ana", apellidos: "Pendiente", fechaAlta: hoy });
  await POST(`/socios/${a.id}/suscripciones`, { actividad: "gimnasio", importe: 35 });
  let s = await GET(`/socios/${a.id}`);
  check("A) alta sin pago → pendiente", s.suscripciones[0].estado, "pendiente");
  check("A) sin ingresos", await ingresosMes(), 0);

  // B) Alta "ya estaba pagado" (archivador) → al día SIN ingresos, y marcada como manual.
  const b = await POST("/socios", { nombre: "Berta", apellidos: "Archivador", fechaAlta: hoy });
  const phB = addMeses(hoy, 1);
  const subB = await POST(`/socios/${b.id}/suscripciones`, { actividad: "karate", importe: 35, pagadoHasta: phB });
  s = await GET(`/socios/${b.id}`);
  check("B) papel → al día", s.suscripciones[0].estado, "aldia");
  check("B) papel → marcado 'apuntado a mano'", s.suscripciones[0].coberturaSinCobro, true);
  check("B) papel NO genera ingresos", await ingresosMes(), 0);
  const metB = await GET(`/metricas?desde=${mes}&hasta=${mes}`);
  check("B) métricas avisan del socio con cobertura manual", metB.socios.coberturaManual, 1);

  // C) Alta "cobrar ahora" → pago real: ingresos, historial y cobertura de 1 mes.
  const c = await POST("/socios", { nombre: "Carlos", apellidos: "CobraYa", fechaAlta: hoy });
  await POST(`/socios/${c.id}/suscripciones`, { actividad: "pilates", importe: 40, cobroInicial: { metodo: "bizum" } });
  s = await GET(`/socios/${c.id}`);
  check("C) cobro inicial → al día", s.suscripciones[0].estado, "aldia");
  check("C) cobertura = hoy + 1 mes", s.suscripciones[0].pagadoHasta, addMeses(hoy, 1));
  check("C) NO es cobertura manual (hay pago detrás)", s.suscripciones[0].coberturaSinCobro, false);
  check("C) el cobro inicial cuenta en ingresos", await ingresosMes(), 40);
  const pagosC = await GET(`/pagos/de-socio/${c.id}`);
  check("C) hay 1 pago en el historial (con recibo posible)", pagosC.length, 1);
  check("C) método respetado", pagosC[0].metodo, "bizum");

  // D) Sin duplicidad: al socio del cobro inicial se le cobra el mes siguiente.
  await POST("/pagos", { socioId: c.id, lineas: [{ suscripcionId: s.suscripciones[0].id, importe: 40, meses: 1 }] });
  s = await GET(`/socios/${c.id}`);
  check("D) dos pagos reales = dos ingresos (sin duplicar)", await ingresosMes(), 80);
  check("D) cobertura encadena (+2 meses)", s.suscripciones[0].pagadoHasta, addMeses(hoy, 2));

  // E) Cobro sobre cobertura de papel: extiende desde ella y solo cuenta lo cobrado.
  const pagoE = await POST("/pagos", { socioId: b.id, lineas: [{ suscripcionId: subB.id, importe: 35, meses: 1 }] });
  s = await GET(`/socios/${b.id}`);
  check("E) ingresos = 80 + 35", await ingresosMes(), 115);
  check("E) extiende desde el papel", s.suscripciones[0].pagadoHasta, addMeses(phB, 1));
  check("E) ya no cuenta como 'a mano' (el pago va más allá)", s.suscripciones[0].coberturaSinCobro, false);

  // F) Borrar ese pago → vuelve la cobertura manual del alta (no "Sin pagar").
  await DEL(`/pagos/${pagoE.id}`);
  s = await GET(`/socios/${b.id}`);
  check("F) al borrar el pago vuelve la cobertura del papel", s.suscripciones[0].pagadoHasta, phB);
  check("F) y vuelve a marcarse como manual", s.suscripciones[0].coberturaSinCobro, true);
  check("F) ingresos descuentan el pago borrado", await ingresosMes(), 80);

  // G) Métricas y dashboard cuentan lo mismo.
  const met = await GET(`/metricas?desde=${mes}&hasta=${mes}`);
  check("G) métricas == dashboard", met.totales.ingresos, await ingresosMes());

  // H) La serie desglosa por actividad y la suma cuadra con el total del mes.
  const fila = met.serie[met.serie.length - 1];
  const sumaSegs = (Object.values(fila.porActividad) as number[]).reduce((a, b) => a + b, 0);
  check("H) desglose por actividad suma = ingresos del mes", sumaSegs, fila.ingresos);
  check("H) la proyección del mes en curso parte de lo cobrado", met.proyeccion.cobrado, fila.ingresos);
  check("H) sin mes anterior con pagos, la retención es null", fila.retencion, null);
  check("H) serieAnterior alinea mes a mes (misma longitud)", met.serieAnterior.length, met.serie.length);

  // I) Filtro por actividad: solo cuentan las líneas de esa actividad.
  const mPil = await GET(`/metricas?desde=${mes}&hasta=${mes}&actividad=pilates`);
  check("I) actividad=pilates → los dos pagos de pilates", mPil.totales.ingresos, 80);
  const mKar = await GET(`/metricas?desde=${mes}&hasta=${mes}&actividad=karate`);
  check("I) actividad=karate → 0 (su pago se borró)", mKar.totales.ingresos, 0);
  check("I) el reparto por actividad NO se filtra (enseña las 3)", mPil.porActividad.length > 0, true);

  // J) Bajas con fecha: dar de baja apunta el mes; reactivar lo limpia.
  await PUT(`/socios/${a.id}`, { estado: "baja" });
  let mB = await GET(`/metricas?desde=${mes}&hasta=${mes}`);
  check("J) la baja de hoy cuenta en el mes", mB.serie[mB.serie.length - 1].bajas, 1);
  await PUT(`/socios/${a.id}`, { estado: "activo" });
  mB = await GET(`/metricas?desde=${mes}&hasta=${mes}`);
  check("J) reactivar limpia la fecha de baja", mB.serie[mB.serie.length - 1].bajas, 0);

  // K) Historial de movimientos: cada operación deja su línea.
  const evC = (await GET(`/socios/${c.id}/eventos`)) as { tipo: string; detalle: string }[];
  const tiposC = evC.map((e) => e.tipo);
  check("K) alta del socio apuntada", tiposC.includes("alta"), true);
  check("K) el cobro inicial del alta queda como pago", evC.filter((e) => e.tipo === "pago").length, 2);
  const evB = (await GET(`/socios/${b.id}/eventos`)) as { tipo: string; detalle: string }[];
  check("K) el pago borrado deja constancia", evB.some((e) => e.tipo === "pago_borrado"), true);
  check("K) el alta 'ya estaba pagado' queda descrita", evB.some((e) => e.tipo === "actividad" && e.detalle.includes("ya estaba pagado")), true);
  const evA = (await GET(`/socios/${a.id}/eventos`)) as { tipo: string }[];
  check("K) baja y reactivación apuntadas", evA.some((e) => e.tipo === "baja") && evA.some((e) => e.tipo === "reactivado"), true);

  // ---------------------------------------------------------------------------
  // BONOS POR SESIONES (v1.8): el bono no caduca por fecha, se agota por uso.
  // ---------------------------------------------------------------------------
  const base = await ingresosMes();

  // L) Alta de bono "cobrar ahora": 60 € reales, 20 sesiones, sin fecha.
  const l = await POST("/socios", { nombre: "Lucía", apellidos: "Bono", fechaAlta: hoy });
  const bono = await POST(`/socios/${l.id}/suscripciones`, {
    actividad: "gimnasio",
    importe: 60,
    periodicidad: "bono",
    sesionesPorBono: 20,
    cobroInicial: { metodo: "efectivo" },
  });
  check("L) el bono se lleva por sesiones", bono.esBono, true);
  check("L) 20 sesiones compradas, 20 restantes", [bono.sesiones.compradas, bono.sesiones.restantes], [20, 20]);
  check("L) sin fecha de cobertura", bono.pagadoHasta, null);
  check("L) estado al día", bono.estado, "aldia");
  check("L) el cobro del bono cuenta en ingresos", await ingresosMes(), base + 60);
  const pagosL = await GET(`/pagos/de-socio/${l.id}`);
  check("L) la línea del pago lleva 20 sesiones y ningún periodo", [pagosL[0].lineas[0].sesiones, pagosL[0].lineas[0].periodoHasta], [20, null]);
  const sinSesiones = await fetch(API + `/socios/${l.id}/suscripciones`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actividad: "karate", importe: 60, periodicidad: "bono" }),
  });
  check("L) un bono sin sesiones se rechaza", sinSesiones.status, 400);

  // M) Picar sesiones: 17 → quedan 3 (pronto) · 3 más → 0 (agotado) · 1 más → −1 (a deber).
  for (let i = 0; i < 17; i++) await POST(`/suscripciones/${bono.id}/asistencias`, {});
  s = await GET(`/socios/${l.id}`);
  check("M) tras 17 picadas quedan 3 → 'quedan pocas'", [s.suscripciones[0].sesiones.restantes, s.suscripciones[0].estado], [3, "pronto"]);
  for (let i = 0; i < 3; i++) await POST(`/suscripciones/${bono.id}/asistencias`, {});
  s = await GET(`/socios/${l.id}`);
  check("M) a 0 → agotado (atrasado)", [s.suscripciones[0].sesiones.restantes, s.suscripciones[0].estado], [0, "atrasado"]);
  const aDeber = await POST(`/suscripciones/${bono.id}/asistencias`, {});
  check("M) se puede picar a deber (−1) y sigue agotado", [aDeber.suscripcion.sesiones.restantes, aDeber.suscripcion.estado], [-1, "atrasado"]);
  const futura = await fetch(API + `/suscripciones/${bono.id}/asistencias`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fecha: addMeses(hoy, 1) }),
  });
  check("M) no se puede picar con fecha futura", futura.status, 400);
  const dash = await GET("/dashboard");
  const itemBono = [...dash.porCobrar, ...dash.pronto, ...dash.aldia].find((i: any) => i.suscripcionId === bono.id);
  check("M) el Panel lo lista como bono agotado en 'por cobrar'", [itemBono?.esBono, itemBono?.sesionesRestantes, dash.porCobrar.some((i: any) => i.suscripcionId === bono.id)], [true, -1, true]);

  // N) Deshacer: borrar la última sesión picada devuelve la cuenta; queda en el historial.
  const lista = await GET(`/suscripciones/${bono.id}/asistencias`);
  check("N) el listado tiene las 21 sesiones picadas", lista.length, 21);
  await DEL(`/asistencias/${lista[0].id}`);
  await DEL(`/asistencias/${lista[1].id}`);
  s = await GET(`/socios/${l.id}`);
  check("N) tras deshacer 2 → queda 1 (pronto)", [s.suscripciones[0].sesiones.restantes, s.suscripciones[0].estado], [1, "pronto"]);
  const evL = (await GET(`/socios/${l.id}/eventos`)) as { tipo: string }[];
  check("N) picar y deshacer quedan en Movimientos", [evL.filter((e) => e.tipo === "asistencia").length, evL.filter((e) => e.tipo === "asistencia_deshecha").length], [21, 2]);

  // O) Cobrar 2 bonos de golpe suma 40 sesiones; borrar ese pago las quita solo.
  const pagoO = await POST("/pagos", { socioId: l.id, lineas: [{ suscripcionId: bono.id, importe: 120, bonos: 2 }] });
  s = await GET(`/socios/${l.id}`);
  check("O) 2 bonos → +40 sesiones (quedan 41, al día)", [s.suscripciones[0].sesiones.restantes, s.suscripciones[0].estado], [41, "aldia"]);
  check("O) ingresos = base + 60 + 120", await ingresosMes(), base + 180);
  await DEL(`/pagos/${pagoO.id}`);
  s = await GET(`/socios/${l.id}`);
  check("O) borrar el pago devuelve la cuenta (queda 1)", s.suscripciones[0].sesiones.restantes, 1);
  check("O) y descuenta los ingresos", await ingresosMes(), base + 60);

  // P) "Ya estaba pagado" en bono = sesiones del papelito: sin ingresos, marcado a mano.
  const p = await POST("/socios", { nombre: "Pepe", apellidos: "Papelito", fechaAlta: hoy });
  const bonoP = await POST(`/socios/${p.id}/suscripciones`, { actividad: "gimnasio", importe: 60, periodicidad: "bono", sesionesPorBono: 20, sesionesManual: 5 });
  check("P) 5 sesiones a mano → al día, sin cobro detrás", [bonoP.sesiones.restantes, bonoP.estado, bonoP.coberturaSinCobro], [5, "aldia", true]);
  check("P) el papelito NO genera ingresos", await ingresosMes(), base + 60);
  const metP = await GET(`/metricas?desde=${mes}&hasta=${mes}`);
  check("P) métricas avisan del bono cubierto a mano (Berta + Pepe)", metP.socios.coberturaManual, 2);
  await POST("/pagos", { socioId: p.id, lineas: [{ suscripcionId: bonoP.id, importe: 60, bonos: 1 }] });
  s = await GET(`/socios/${p.id}`);
  check("P) al cobrarle un bono deja de ser 'a mano' (25 restantes)", [s.suscripciones[0].sesiones.restantes, s.suscripciones[0].coberturaSinCobro], [25, false]);

  // Q) EL CASO REAL: bono cobrado ANTES de v1.8 (apuntado como un mes, con fecha).
  //    Se inserta tal cual lo dejó la versión anterior y se comprueba que (1) sigue
  //    igual hasta que se configura, (2) al configurarlo cuenta el cobro como un
  //    bono completo y (3) no se toca ni el pago ni la fecha guardada.
  const { default: Database } = await import("better-sqlite3");
  const q = await POST("/socios", { nombre: "Quique", apellidos: "Antiguo", fechaAlta: hoy });
  const phQ = addMeses(hoy, 1);
  {
    const bd = new Database(join(DATA, "gymgrecia.db"));
    const subQ = bd
      .prepare("INSERT INTO suscripciones (socio_id, actividad, etiqueta, importe, periodicidad, pagado_hasta, cobertura_manual, activa, notas, creado_en) VALUES (?,?,?,?,'bono',?,NULL,1,NULL,?)")
      .run(q.id, "gimnasio", null, 60, phQ, hoy).lastInsertRowid;
    const pagoQ = bd.prepare("INSERT INTO pagos (socio_id, fecha, metodo, total, notas, creado_en) VALUES (?,?,?,?,NULL,?)").run(q.id, hoy, "efectivo", 60, hoy).lastInsertRowid;
    bd.prepare("INSERT INTO pago_lineas (pago_id, suscripcion_id, actividad, concepto, importe, periodo_desde, periodo_hasta) VALUES (?,?,?,?,?,?,?)").run(pagoQ, subQ, "gimnasio", null, 60, hoy, phQ);
    bd.close();
  }
  s = await GET(`/socios/${q.id}`);
  const antiguo = s.suscripciones[0];
  check("Q) antes de configurarlo sigue por fecha (como siempre)", [antiguo.esBono, antiguo.bonoSinConfigurar, antiguo.estado, antiguo.pagadoHasta], [false, true, "aldia", phQ]);
  check("Q) su cobro ya contaba en ingresos", await ingresosMes(), base + 120 + 60);
  await PUT(`/suscripciones/${antiguo.id}`, { periodicidad: "bono", sesionesPorBono: 20 });
  s = await GET(`/socios/${q.id}`);
  const config = s.suscripciones[0];
  check("Q) configurado: el cobro de 60 € cuenta como un bono de 20", [config.esBono, config.sesiones.compradas, config.sesiones.restantes, config.estado], [true, 20, 20, "aldia"]);
  check("Q) ya no muestra fecha", config.pagadoHasta, null);
  check("Q) ingresos NO cambian", await ingresosMes(), base + 180);
  {
    const bd = new Database(join(DATA, "gymgrecia.db"), { readonly: true });
    const fila = bd.prepare("SELECT pagado_hasta, sesiones_por_bono FROM suscripciones WHERE id = ?").get(antiguo.id) as any;
    const linea = bd.prepare("SELECT importe, periodo_desde, periodo_hasta, sesiones FROM pago_lineas WHERE suscripcion_id = ?").get(antiguo.id) as any;
    bd.close();
    check("Q) la fecha guardada NO se ha tocado (solo se ignora)", fila.pagado_hasta, phQ);
    check("Q) el pago antiguo está intacto (importe, periodo); sus sesiones quedan escritas (20)", [linea.importe, linea.periodo_desde, linea.periodo_hasta, linea.sesiones], [60, hoy, phQ, 20]);
  }
  await POST(`/suscripciones/${antiguo.id}/asistencias`, { fecha: addMeses(hoy, -1) > s.fechaAlta ? addMeses(hoy, -1) : hoy });
  s = await GET(`/socios/${q.id}`);
  check("Q) se pueden picar visitas anteriores con su fecha (quedan 19)", s.suscripciones[0].sesiones.restantes, 19);
  // Q2) Cambiar el tamaño del bono NO revaloriza cobros antiguos (sus sesiones están congeladas).
  await PUT(`/suscripciones/${antiguo.id}`, { periodicidad: "bono", sesionesPorBono: 10 });
  s = await GET(`/socios/${q.id}`);
  check("Q2) bono 20 → 10: el cobro antiguo sigue valiendo 20 (quedan 19)", [s.suscripciones[0].sesionesPorBono, s.suscripciones[0].sesiones.restantes], [10, 19]);
  const malo = await fetch(API + `/suscripciones/${antiguo.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ periodicidad: "bono", sesionesPorBono: 0 }) });
  check("Q2) no se puede dejar un bono sin sesiones (400)", malo.status, 400);
  const neg = await fetch(API + `/suscripciones/${antiguo.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sesionesManual: -5 }) });
  check("Q2) sesiones a mano negativas → 400", neg.status, 400);

  // Q3) Bono antiguo que venía «ya estaba pagado» del papelito (fecha a mano, SIN pago):
  //     al configurarlo hereda un bono completo apuntado a mano (no queda «Sin bono»).
  const q3 = await POST("/socios", { nombre: "Quima", apellidos: "Papel", fechaAlta: hoy });
  {
    const bd = new Database(join(DATA, "gymgrecia.db"));
    bd.prepare("INSERT INTO suscripciones (socio_id, actividad, etiqueta, importe, periodicidad, pagado_hasta, cobertura_manual, activa, notas, creado_en) VALUES (?,?,?,?,'bono',?,?,1,NULL,?)").run(q3.id, "gimnasio", null, 60, phQ, phQ, hoy);
    bd.close();
  }
  s = await GET(`/socios/${q3.id}`);
  check("Q3) antes: al día por fecha a mano", [s.suscripciones[0].estado, s.suscripciones[0].coberturaSinCobro], ["aldia", true]);
  await PUT(`/suscripciones/${s.suscripciones[0].id}`, { periodicidad: "bono", sesionesPorBono: 20 });
  s = await GET(`/socios/${q3.id}`);
  check("Q3) configurado: 20 sesiones a mano, sigue al día y marcado «a mano»", [s.suscripciones[0].sesiones.manual, s.suscripciones[0].sesiones.restantes, s.suscripciones[0].estado, s.suscripciones[0].coberturaSinCobro], [20, 20, "aldia", true]);
  check("Q3) sin ingresos nuevos", await ingresosMes(), base + 180);

  // R) Cuota MENSUAL que pasa a bono: sus meses cobrados NO cuentan como sesiones.
  s = await GET(`/socios/${c.id}`); // Carlos: pilates mensual con 2 pagos
  await PUT(`/suscripciones/${s.suscripciones[0].id}`, { periodicidad: "bono", sesionesPorBono: 10 });
  s = await GET(`/socios/${c.id}`);
  check("R) mensual → bono arranca a 0 sesiones (sin bono)", [s.suscripciones[0].sesiones.compradas, s.suscripciones[0].estado], [0, "pendiente"]);
  check("R) sus pagos siguen contando en ingresos", await ingresosMes(), base + 180);
  await PUT(`/suscripciones/${s.suscripciones[0].id}`, { periodicidad: "mensual" });
  s = await GET(`/socios/${c.id}`);
  check("R) y vuelta a mensual recupera su fecha", [s.suscripciones[0].esBono, s.suscripciones[0].pagadoHasta], [false, addMeses(hoy, 2)]);
}

main()
  .then(() => {
    console.log(fallos === 0 ? `✓ Ingresos: ${total} comprobaciones OK.` : `${fallos}/${total} comprobaciones fallan.`);
    process.exitCode = fallos === 0 ? 0 : 1;
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    servidor.kill();
    // Dar un instante a que suelte la BD antes de borrar la carpeta temporal.
    setTimeout(() => {
      try {
        rmSync(DATA, { recursive: true, force: true });
      } catch {
        /* carpeta temporal; el SO la limpiará */
      }
    }, 500).unref();
  });
