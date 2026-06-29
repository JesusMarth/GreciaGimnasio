// Pruebas de la lógica de filtros con datos mockeados. Ejecutar: npm run test:filtros
import type { Socio, Suscripcion, EstadoCuota } from "./types.ts";
import { filtrarSocios, grupoCuota, hayFiltrosActivos, rangoDePreset, rangoDeAnio, FILTROS_VACIOS, type FiltrosSocios } from "./filtros.ts";

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
  return { id: 1, socioId: 1, actividad: "gimnasio", etiqueta: null, importe: 30, periodicidad: "mensual", pagadoHasta: null, activa: true, notas: null, estado: "aldia", dias: 30, ...over };
}
function soc(id: number, fechaAlta: string, estado: string, estadoResumen: EstadoCuota | null, subs: Suscripcion[], sexo: string | null = null): Socio {
  return { id, nombre: "Socio " + id, telefono: null, email: null, dni: null, sexo, fechaAlta, fechaNacimiento: null, estado, notas: null, suscripciones: subs, estadoResumen, proximaExpiracion: null };
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

console.log("\n— hayFiltrosActivos —");
check("vacío → false", hayFiltrosActivos(FILTROS_VACIOS) === false);
check("con actividad → true", hayFiltrosActivos(F({ actividades: ["karate"] })) === true);
check("con sexo → true", hayFiltrosActivos(F({ sexo: ["hombre"] })) === true);
check("con fecha → true", hayFiltrosActivos(F({ fecha: { desde: "2026-01-01", hasta: null } })) === true);

console.log(fallos === 0 ? `\n✅ Todas las pruebas OK (${0} fallos)` : `\n❌ ${fallos} prueba(s) fallan`);
process.exit(fallos === 0 ? 0 : 1);
