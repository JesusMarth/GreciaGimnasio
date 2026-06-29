import ExcelJS from "exceljs";
import { db } from "./db.ts";
import { socioConResumen, type SocioRow } from "./queries.ts";
import { diffDias } from "./util.ts";
import { ddmmaaaa } from "./recibo.ts";

const ESTADO_TXT: Record<string, string> = {
  aldia: "Al día",
  pronto: "Vence pronto",
  atrasado: "Atrasado",
  pendiente: "Sin pagar",
};
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const sexoTxt = (s: string | null) => (s === "hombre" ? "Hombre" : s === "mujer" ? "Mujer" : "");
const EUR = '#,##0.00" €"';

function estilaCabecera(ws: ExcelJS.Worksheet) {
  const h = ws.getRow(1);
  h.font = { bold: true, color: { argb: "FFFFFFFF" } };
  h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F5BB8" } };
  h.alignment = { vertical: "middle" };
  h.height = 20;
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

async function aBuffer(wb: ExcelJS.Workbook): Promise<Buffer> {
  const data: any = await wb.xlsx.writeBuffer();
  return Buffer.isBuffer(data) ? data : Buffer.from(data);
}

/** Listado de socios (todos, o solo los ids indicados). Una hoja resumen. */
export async function libroSocios(ids?: number[]): Promise<Buffer> {
  let filas: SocioRow[];
  if (ids && ids.length) {
    const ph = ids.map(() => "?").join(",");
    filas = db.prepare(`SELECT * FROM socios WHERE id IN (${ph}) ORDER BY nombre`).all(...ids) as SocioRow[];
  } else {
    filas = db.prepare("SELECT * FROM socios ORDER BY nombre").all() as SocioRow[];
  }
  const socios = filas.map((s) => socioConResumen(s));

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Socios");
  ws.columns = [
    { header: "Nombre", key: "nombre", width: 28 },
    { header: "DNI/NIF", key: "dni", width: 14 },
    { header: "Sexo", key: "sexo", width: 10 },
    { header: "Teléfono", key: "tel", width: 14 },
    { header: "Email", key: "email", width: 26 },
    { header: "Estado", key: "estado", width: 10 },
    { header: "Alta", key: "alta", width: 12 },
    { header: "Actividades activas", key: "acts", width: 28 },
    { header: "Cuota activa", key: "cuota", width: 13, style: { numFmt: EUR } },
    { header: "Estado cuota", key: "cuotaEstado", width: 14 },
  ];
  for (const s of socios) {
    const activas = s.suscripciones.filter((x) => x.activa);
    ws.addRow({
      nombre: s.nombre,
      dni: s.dni ?? "",
      sexo: sexoTxt(s.sexo),
      tel: s.telefono ?? "",
      email: s.email ?? "",
      estado: s.estado === "baja" ? "Baja" : "Activo",
      alta: ddmmaaaa(s.fechaAlta),
      acts: activas.map((x) => cap(x.actividad)).join(", "),
      cuota: activas.reduce((acc, x) => acc + x.importe, 0),
      cuotaEstado: s.estadoResumen ? ESTADO_TXT[s.estadoResumen] : "Sin cuotas",
    });
  }
  estilaCabecera(ws);
  return aBuffer(wb);
}

/** Informe detallado de un socio: datos, actividades y pagos con análisis de retraso. */
export async function libroSocio(id: number): Promise<Buffer> {
  const fila = db.prepare("SELECT * FROM socios WHERE id = ?").get(id) as SocioRow | undefined;
  if (!fila) throw new Error("Socio no encontrado");
  const socio = socioConResumen(fila);

  const wb = new ExcelJS.Workbook();

  // Hoja 1 · Datos del socio
  const d = wb.addWorksheet("Datos");
  d.columns = [
    { key: "k", width: 22 },
    { key: "v", width: 42 },
  ];
  const datos: [string, string][] = [
    ["Socio", socio.nombre],
    ["DNI/NIF", socio.dni ?? ""],
    ["Sexo", sexoTxt(socio.sexo)],
    ["Teléfono", socio.telefono ?? ""],
    ["Email", socio.email ?? ""],
    ["Estado", socio.estado === "baja" ? "Baja" : "Activo"],
    ["Alta", ddmmaaaa(socio.fechaAlta)],
    ["Estado de cuota", socio.estadoResumen ? ESTADO_TXT[socio.estadoResumen] : "Sin cuotas"],
  ];
  for (const [k, v] of datos) {
    const r = d.addRow({ k, v });
    r.getCell("k").font = { bold: true };
  }

  // Hoja 2 · Actividades
  const a = wb.addWorksheet("Actividades");
  a.columns = [
    { header: "Actividad", key: "act", width: 16 },
    { header: "Etiqueta", key: "etq", width: 22 },
    { header: "Importe", key: "imp", width: 12, style: { numFmt: EUR } },
    { header: "Periodicidad", key: "per", width: 14 },
    { header: "Pagado hasta", key: "ph", width: 14 },
    { header: "Estado", key: "est", width: 14 },
    { header: "Activa", key: "activa", width: 10 },
  ];
  for (const s of socio.suscripciones) {
    a.addRow({
      act: cap(s.actividad),
      etq: s.etiqueta ?? "",
      imp: s.importe,
      per: s.periodicidad === "bono" ? "Bono" : "Mensual",
      ph: s.pagadoHasta ? ddmmaaaa(s.pagadoHasta) : "—",
      est: ESTADO_TXT[s.estado] ?? s.estado,
      activa: s.activa ? "Sí" : "No",
    });
  }
  estilaCabecera(a);

  // Hoja 3 · Pagos (una fila por línea), con días respecto al inicio del periodo
  const p = wb.addWorksheet("Pagos");
  p.columns = [
    { header: "Fecha pago", key: "fecha", width: 13 },
    { header: "Actividad", key: "act", width: 16 },
    { header: "Concepto", key: "concepto", width: 22 },
    { header: "Importe", key: "imp", width: 12, style: { numFmt: EUR } },
    { header: "Periodo desde", key: "desde", width: 14 },
    { header: "Periodo hasta", key: "hasta", width: 14 },
    { header: "Método", key: "metodo", width: 14 },
    { header: "Días tras inicio (+ = tarde)", key: "retraso", width: 26 },
  ];
  const pagos = db.prepare("SELECT * FROM pagos WHERE socio_id = ? ORDER BY fecha, id").all(id) as any[];
  const lineasStmt = db.prepare("SELECT * FROM pago_lineas WHERE pago_id = ?");
  for (const pago of pagos) {
    for (const l of lineasStmt.all(pago.id) as any[]) {
      p.addRow({
        fecha: ddmmaaaa(pago.fecha),
        act: cap(l.actividad),
        concepto: l.concepto ?? "",
        imp: l.importe,
        desde: l.periodo_desde ? ddmmaaaa(l.periodo_desde) : "—",
        hasta: l.periodo_hasta ? ddmmaaaa(l.periodo_hasta) : "—",
        metodo: cap(pago.metodo),
        retraso: l.periodo_desde ? diffDias(pago.fecha, l.periodo_desde) : "",
      });
    }
  }
  estilaCabecera(p);

  return aBuffer(wb);
}
