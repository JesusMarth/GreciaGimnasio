// Rellena un entorno de PRUEBAS con datos de mentira. Se ejecuta con
// GYM_DATA_DIR=data-mock (lo pone GymGrecia-MOCK.bat) para no tocar los datos reales.
// Solo siembra si la base está vacía; para empezar de cero, borra la carpeta data-mock.
import { db, DATA_DIR, reconstruirEventos } from "./db.ts";
import { addMeses, hoyISO } from "./util.ts";

const NOMBRES = [
  "María", "Lucía", "Martina", "Paula", "Sofía", "Daniela", "Valeria", "Carmen", "Laura", "Sara",
  "Nerea", "Elena", "Clara", "Alba", "Marta", "Daniel", "Hugo", "Pablo", "Álvaro", "Adrián",
  "Marcos", "Iván", "Rubén", "Sergio", "Jorge", "Diego", "Mario", "Raúl", "Andrés", "Jesús",
];
const APELLIDOS = [
  "García", "Martín", "López", "Sánchez", "Pérez", "Gómez", "Fernández", "Ruiz", "Díaz", "Moreno",
  "Romero", "Saldaña", "Navarro", "Torres", "Gil", "Vázquez", "Serrano", "Castro", "Ortega", "Rubio",
  "Molina", "Delgado", "Marín", "Suárez", "Ramos",
];
const ACTS = ["gimnasio", "karate", "pilates"];
const METODOS = ["efectivo", "transferencia", "bizum", "tarjeta"];
const IMPORTES = [27, 30, 32, 35, 40, 45];

const r = (n: number) => Math.floor(Math.random() * n);
const elige = <T>(a: T[]): T => a[r(a.length)];
function addDias(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const ya = (db.prepare("SELECT COUNT(*) AS n FROM socios").get() as { n: number }).n;
if (ya > 0) {
  console.log(`Ya hay ${ya} socios en ${DATA_DIR}; no se regenera. (Para empezar de cero, borra esa carpeta.)`);
  process.exit(0);
}

const hoy = hoyISO();
/** Meses enteros entre dos fechas ISO (b - a). */
function diffMeses(a: string, b: string): number {
  return (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + (Number(b.slice(5, 7)) - Number(a.slice(5, 7)));
}
const insSocio = db.prepare(
  "INSERT INTO socios (nombre, apellidos, telefono, email, dni, sexo, fecha_alta, fecha_nacimiento, estado, fecha_baja, notas, creado_en) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"
);
const insSub = db.prepare(
  "INSERT INTO suscripciones (socio_id, actividad, etiqueta, importe, periodicidad, pagado_hasta, cobertura_manual, activa, notas, creado_en) VALUES (?,?,?,?,?,?,?,?,?,?)"
);
const insPago = db.prepare("INSERT INTO pagos (socio_id, fecha, metodo, total, notas, creado_en) VALUES (?,?,?,?,?,?)");
const insLinea = db.prepare(
  "INSERT INTO pago_lineas (pago_id, suscripcion_id, actividad, concepto, importe, periodo_desde, periodo_hasta) VALUES (?,?,?,?,?,?,?)"
);

const sembrar = db.transaction(() => {
  for (let i = 0; i < 60; i++) {
    const fnIdx = r(NOMBRES.length); // los 15 primeros nombres son de mujer; el resto, de hombre
    const nombre = NOMBRES[fnIdx];
    const apellidos = `${elige(APELLIDOS)} ${elige(APELLIDOS)}`;
    const sexo = r(12) === 0 ? null : fnIdx < 15 ? "mujer" : "hombre"; // ~8% sin asignar (como socios antiguos)
    const tel = "6" + String(20000000 + r(79999999));
    const email = r(10) < 7 ? `socio${i + 1}@ejemplo.com` : null;
    const dni = r(10) < 6 ? `${10000000 + r(89999999)}X` : null;
    const alta = addDias(addMeses(hoy, -r(36)), -r(28)); // hasta ~3 años atrás, día variado
    const estado = r(10) < 9 ? "activo" : "baja";
    // ~70% de las bajas llevan fecha (las demás son "antiguas", de antes de guardarla).
    let fechaBaja: string | null = null;
    if (estado === "baja" && r(10) < 7) {
      fechaBaja = addDias(addMeses(hoy, -r(12)), -r(28));
      if (fechaBaja <= alta) fechaBaja = addDias(alta, 40 + r(280));
      if (fechaBaja > hoy) fechaBaja = hoy;
    }
    const socioId = insSocio.run(nombre, apellidos, tel, email, dni, sexo, alta, null, estado, fechaBaja, null, hoy).lastInsertRowid as number;

    // 1-3 actividades distintas
    const acts = [...ACTS].sort(() => Math.random() - 0.5).slice(0, 1 + r(3));
    for (const act of acts) {
      const importe = elige(IMPORTES);
      const activa = estado === "baja" ? (r(2) === 0 ? 1 : 0) : r(10) < 9 ? 1 : 0;
      // Reparte el estado de cuota: 0 pendiente · 1 atrasado · 2 vence pronto · 3 al día
      let pagadoHasta: string | null = null;
      if (activa === 1) {
        const bucket = r(4);
        if (bucket === 1) pagadoHasta = addMeses(hoy, -(1 + r(2)));
        else if (bucket === 2) pagadoHasta = addDias(hoy, r(7));
        else if (bucket === 3) pagadoHasta = addMeses(hoy, 1 + r(2));
      }
      // ~1 de cada 4 cuotas cubiertas viene "del archivador": cobertura apuntada a
      // mano en el alta, SIN pagos registrados (como pasa con los datos reales).
      const delArchivador = pagadoHasta != null && r(4) === 0;
      const subId = insSub.run(
        socioId, act, null, importe, "mensual", pagadoHasta, delArchivador ? pagadoHasta : null, activa, null, hoy
      ).lastInsertRowid as number;

      // Historial de pagos mensuales que llevan hasta "pagadoHasta" (sin fechas
      // futuras). Arranca cerca del alta (hasta ~30 meses) para que Métricas tenga
      // varios años y comparativa interanual, y deja HUECOS de vez en cuando
      // (meses en los que el socio no vino) para que la retención no sea plana.
      if (pagadoHasta && !delArchivador) {
        const tope = Math.max(2, Math.min(diffMeses(alta, pagadoHasta), 6 + r(25)));
        for (let m = tope; m >= 1; m--) {
          if (m !== 1 && r(9) === 0) continue; // hueco (el último mes nunca falta: respalda pagadoHasta)
          const hasta = addMeses(pagadoHasta, -(m - 1));
          const desde = addMeses(hasta, -1);
          const fecha = desde > hoy ? hoy : desde;
          const pagoId = insPago.run(socioId, fecha, elige(METODOS), importe, null, hoy).lastInsertRowid as number;
          insLinea.run(pagoId, subId, act, null, importe, desde, hasta);
        }
      }
    }
  }
});
sembrar();
// El historial de movimientos del mock se reconstruye de lo sembrado (como pasaría
// en una BD real recién actualizada).
reconstruirEventos(db);

const n = (db.prepare("SELECT COUNT(*) AS n FROM socios").get() as { n: number }).n;
const np = (db.prepare("SELECT COUNT(*) AS n FROM pagos").get() as { n: number }).n;
console.log(`Entorno MOCK generado en ${DATA_DIR}: ${n} socios y ${np} pagos.`);
process.exit(0);
