// Pruebas de la lógica de filtros con datos mockeados. Ejecutar: npm run test:filtros
import type { Socio, Suscripcion, EstadoCuota } from "./types.ts";
import { avisosDe, claveImporte, filtrarSocios, grupoCuota, hayFiltrosActivos, importesUltimoPago, rangoDePreset, rangoDeAnio, FILTROS_VACIOS, type FiltrosSocios } from "./filtros.ts";

// --- Mini arnés de aserciones ---
let fallos = 0;
function check(nombre: string, cond: boolean) {
  console.log((cond ? "  ✓ " : "  ✗ FALLA: ") + nombre);
  if (!cond) fallos++;
}
const ids = (socios: Socio[]) => socios.map((s) => s.id).sort((a, b) => a - b);
const igual = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

// --- Factorías de datos mock ---
function sub(over: Partial<Suscripcion>): Suscripcion {
  return { id: 1, socioId: 1, actividad: "gimnasio", etiqueta: null, importe: 30, periodicidad: "mensual", pagadoHasta: null, coberturaSinCobro: false, activa: true, notas: null, estado: "aldia", dias: 30, ...over };
}
function soc(id: number, fechaAlta: string, estado: string, estadoResumen: EstadoCuota | null, subs: Suscripcion[], sexo: string | null = null, ultimoPago: { fecha: string; total: number } | null = null): Socio {
  return { id, nombre: "Socio", apellidos: String(id), nombreCompleto: "Socio " + id, telefono: null, email: null, dni: null, sexo, fechaAlta, fechaNacimiento: null, estado, notas: null, suscripciones: subs, estadoResumen, proximaExpiracion: null, ultimoPago };
}

const HOY = "2026-06-24"; // miércoles
const socios: Socio[] = [
  soc(1, "2026-06-24", "activo", "aldia", [sub({ actividad: "gimnasio", activa: true })], "hombre"),
  soc(2, "2026-06-01", "activo", "atrasado", [sub({ actividad: "karate", activa: true })], "mujer"),
  soc(3, "2025-12-15", "activo", "pendiente", [sub({ actividad: "pilates", activa: true })], null),
  soc(4, "2026-06-23", "activo", "pronto", [sub({ actividad: "gimnasio", activa: true }), sub({ actividad: "karate", activa: true })], "hombre"),
  soc(5, "2024-03-10", "baja", null, [sub({ actividad: "gimnasio", activa: false })], "mujer"),
  soc(6, "2026-06-18", "activo", "aldia", [sub({ actividad: "gimnasio", activa: true })], null),
];
const F = (over: Partial<FiltrosSocios>): FiltrosSocios => ({ ...FILTROS_VACIOS, ...over });

console.log("\n— grupoCuota —");
check("atrasado → pendiente", grupoCuota("atrasado") === "pendiente");
check("pendiente → pendiente", grupoCuota("pendiente") === "pendiente");
check("pronto → pronto", grupoCuota("pronto") === "pronto");
check("aldia → aldia", grupoCuota("aldia") === "aldia");
check("null → sin", grupoCuota(null) === "sin");

console.log("\n— filtrarSocios: actividad —");
check("karate → [2,4]", igual(ids(filtrarSocios(socios, F({ actividades: ["karate"] }))), [2, 4]));
check("gimnasio (solo activas) → [1,4,6]", igual(ids(filtrarSocios(socios, F({ actividades: ["gimnasio"] }))), [1, 4, 6]));
check("karate+pilates (OR) → [2,3,4]", igual(ids(filtrarSocios(socios, F({ actividades: ["karate", "pilates"] }))), [2, 3, 4]));

console.log("\n— filtrarSocios: estado —");
check("baja → [5]", igual(ids(filtrarSocios(socios, F({ estado: ["baja"] }))), [5]));
check("activo → [1,2,3,4,6]", igual(ids(filtrarSocios(socios, F({ estado: ["activo"] }))), [1, 2, 3, 4, 6]));

console.log("\n— filtrarSocios: cuota —");
check("pendientes (atrasado+pendiente) → [2,3]", igual(ids(filtrarSocios(socios, F({ cuota: ["pendiente"] }))), [2, 3]));
check("al día → [1,6]", igual(ids(filtrarSocios(socios, F({ cuota: ["aldia"] }))), [1, 6]));
check("vencen pronto → [4]", igual(ids(filtrarSocios(socios, F({ cuota: ["pronto"] }))), [4]));
check("sin cuotas → [5]", igual(ids(filtrarSocios(socios, F({ cuota: ["sin"] }))), [5]));

console.log("\n— filtrarSocios: sexo —");
check("hombre → [1,4]", igual(ids(filtrarSocios(socios, F({ sexo: ["hombre"] }))), [1, 4]));
check("mujer → [2,5]", igual(ids(filtrarSocios(socios, F({ sexo: ["mujer"] }))), [2, 5]));
check("hombre+mujer → [1,2,4,5] (excluye sin sexo)", igual(ids(filtrarSocios(socios, F({ sexo: ["hombre", "mujer"] }))), [1, 2, 4, 5]));
check("sin asignar → [3,6] (posibles olvidos)", igual(ids(filtrarSocios(socios, F({ sexo: ["sin"] }))), [3, 6]));
check("mujer + sin asignar → [2,3,5,6]", igual(ids(filtrarSocios(socios, F({ sexo: ["mujer", "sin"] }))), [2, 3, 5, 6]));

console.log("\n— filtrarSocios: fecha de alta (presets, hoy=2026-06-24) —");
check("hoy → [1]", igual(ids(filtrarSocios(socios, F({ fecha: rangoDePreset("hoy", HOY) }))), [1]));
check("ayer → [4]", igual(ids(filtrarSocios(socios, F({ fecha: rangoDePreset("ayer", HOY) }))), [4]));
check("últimos 7 días → [1,4,6]", igual(ids(filtrarSocios(socios, F({ fecha: rangoDePreset("ult7", HOY) }))), [1, 4, 6]));
check("este mes → [1,2,4,6]", igual(ids(filtrarSocios(socios, F({ fecha: rangoDePreset("mes", HOY) }))), [1, 2, 4, 6]));
check("este año → [1,2,4,6]", igual(ids(filtrarSocios(socios, F({ fecha: rangoDePreset("anio", HOY) }))), [1, 2, 4, 6]));

console.log("\n— rangos de preset —");
const r = (p: any) => JSON.stringify(rangoDePreset(p, HOY));
check("hoy", r("hoy") === JSON.stringify({ desde: "2026-06-24", hasta: "2026-06-24" }));
check("ayer", r("ayer") === JSON.stringify({ desde: "2026-06-23", hasta: "2026-06-23" }));
check("ult7", r("ult7") === JSON.stringify({ desde: "2026-06-18", hasta: "2026-06-24" }));
check("semana (lun-dom)", r("semana") === JSON.stringify({ desde: "2026-06-22", hasta: "2026-06-28" }));
check("mes", r("mes") === JSON.stringify({ desde: "2026-06-01", hasta: "2026-06-30" }));
check("anio", r("anio") === JSON.stringify({ desde: "2026-01-01", hasta: "2026-12-31" }));
check("rangoDeAnio(2025)", JSON.stringify(rangoDeAnio(2025)) === JSON.stringify({ desde: "2025-01-01", hasta: "2025-12-31" }));

console.log("\n— combinaciones —");
check("gimnasio + al día → [1,6]", igual(ids(filtrarSocios(socios, F({ actividades: ["gimnasio"], cuota: ["aldia"] }))), [1, 6]));
check("activo + este mes → [1,2,4,6]", igual(ids(filtrarSocios(socios, F({ estado: ["activo"], fecha: rangoDePreset("mes", HOY) }))), [1, 2, 4, 6]));
check("karate + alta este año → [2,4]", igual(ids(filtrarSocios(socios, F({ actividades: ["karate"], fecha: rangoDePreset("anio", HOY) }))), [2, 4]));
check("rango personalizado 2026-06-18..2026-06-23 → [4,6]", igual(ids(filtrarSocios(socios, F({ fecha: { desde: "2026-06-18", hasta: "2026-06-23" } }))), [4, 6]));
check("sin filtros → todos", igual(ids(filtrarSocios(socios, FILTROS_VACIOS)), [1, 2, 3, 4, 5, 6]));

console.log("\n— filtrarSocios: avisos ('aquí pasa algo') —");
const sociosAviso: Socio[] = [
  soc(101, "2026-01-01", "activo", "aldia", [sub({ id: 11, coberturaSinCobro: true })]),
  soc(102, "2026-01-01", "activo", "aldia", [sub({ id: 12 })]),
  soc(103, "2026-01-01", "activo", "aldia", [sub({ id: 13, coberturaSinCobro: true, activa: false }), sub({ id: 14 })]),
  soc(104, "2026-01-01", "activo", "atrasado", [sub({ id: 15, coberturaSinCobro: true, estado: "atrasado", dias: -9 })]),
  soc(105, "2026-01-01", "activo", "pronto", [sub({ id: 16, coberturaSinCobro: true, estado: "pronto", dias: 3 })]),
];
check("con aviso → cobertura a mano ACTIVA y VIGENTE (al día o pronto)", igual(ids(filtrarSocios(sociosAviso, F({ avisos: ["con"] }))), [101, 105]));
check("una cuota a mano INACTIVA no avisa", !ids(filtrarSocios(sociosAviso, F({ avisos: ["con"] }))).includes(103));
check("una cuota a mano ya VENCIDA no avisa (es un atrasado normal)", !ids(filtrarSocios(sociosAviso, F({ avisos: ["con"] }))).includes(104));
check("avisos vacío → todos", igual(ids(filtrarSocios(sociosAviso, F({}))), [101, 102, 103, 104, 105]));
check("con aviso + al día se combinan", igual(ids(filtrarSocios(sociosAviso, F({ avisos: ["con"], cuota: ["aldia"] }))), [101]));
check("avisosDe: con motivo", avisosDe(sociosAviso[0]).length === 1);
check("avisosDe: sin motivo", avisosDe(sociosAviso[1]).length === 0);

console.log("\n— filtrarSocios: último pago —");
const sociosPago: Socio[] = [
  soc(201, "2026-01-01", "activo", "aldia", [sub({})], null, { fecha: "2026-06-01", total: 35 }),
  soc(202, "2026-01-01", "activo", "aldia", [sub({})], null, { fecha: "2026-06-10", total: 30 }),
  soc(203, "2026-01-01", "activo", "aldia", [sub({})], null, { fecha: "2026-05-20", total: 35 }),
  soc(204, "2026-01-01", "activo", "aldia", [sub({})], null, { fecha: "2026-04-02", total: 180 }),
  soc(205, "2026-01-01", "activo", "pendiente", [sub({})], null, null), // nunca pagó
  soc(206, "2026-01-01", "activo", "aldia", [sub({})], null, { fecha: "2026-06-15", total: 32.5 }),
];
check("importe 35 → [201,203]", igual(ids(filtrarSocios(sociosPago, F({ pagos: ["35"] }))), [201, 203]));
check("importe 30 o 180 (OR) → [202,204]", igual(ids(filtrarSocios(sociosPago, F({ pagos: ["30", "180"] }))), [202, 204]));
check("con decimales (32.5) → [206]", igual(ids(filtrarSocios(sociosPago, F({ pagos: [claveImporte(32.5)] }))), [206]));
check("sin último pago nunca coincide", !ids(filtrarSocios(sociosPago, F({ pagos: ["35", "30", "180"] }))).includes(205));
check("pagos vacío → todos", igual(ids(filtrarSocios(sociosPago, F({}))), [201, 202, 203, 204, 205, 206]));
check("se combina con cuota (35 + pendiente) → []", igual(ids(filtrarSocios(sociosPago, F({ pagos: ["35"], cuota: ["pendiente"] }))), []));
check("importesUltimoPago: distintos y ordenados", JSON.stringify(importesUltimoPago(sociosPago)) === JSON.stringify([30, 32.5, 35, 180]));
check("importesUltimoPago: sin cobros → []", JSON.stringify(importesUltimoPago([sociosPago[4]])) === JSON.stringify([]));
check("claveImporte estable (35 → '35', 32.5 → '32.5')", claveImporte(35) === "35" && claveImporte(32.5) === "32.5");

console.log("\n— hayFiltrosActivos —");
check("vacío → false", hayFiltrosActivos(FILTROS_VACIOS) === false);
check("con actividad → true", hayFiltrosActivos(F({ actividades: ["karate"] })) === true);
check("con sexo → true", hayFiltrosActivos(F({ sexo: ["hombre"] })) === true);
check("con avisos → true", hayFiltrosActivos(F({ avisos: ["con"] })) === true);
check("con pagos → true", hayFiltrosActivos(F({ pagos: ["35"] })) === true);
check("con fecha → true", hayFiltrosActivos(F({ fecha: { desde: "2026-01-01", hasta: null } })) === true);

console.log(fallos === 0 ? `\n✅ Todas las pruebas OK (${0} fallos)` : `\n❌ ${fallos} prueba(s) fallan`);
process.exit(fallos === 0 ? 0 : 1);
