import ExcelJS from "exceljs";
import { db } from "./db.ts";
import { socioConResumen, type SocioRow } from "./queries.ts";
import { diffDias, hoyISO } from "./util.ts";
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

/** "30 €" / "32,50 €" para textos (las columnas numéricas ya usan el formato EUR). */
const importeTxt = (n: number) => (Number.isInteger(n) ? `${n} €` : `${n.toFixed(2).replace(".", ",")} €`);

// Colores del estado de cuota (mismo semáforo que la app) y rellenos de apoyo.
const COLOR_ESTADO: Record<string, string> = {
  aldia: "FF1E7B34", // verde
  pronto: "FF9C6F00", // ámbar
  atrasado: "FFC00000", // rojo
  pendiente: "FF6A329F", // morado (sin pagar)
};
const FILL_ZEBRA: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F6FC" } };
const FILL_GRUPO: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFE3C6" } };
const FILL_SUBCAB: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEDED" } };

function pintaEstadoCuota(cell: ExcelJS.Cell, estado: string | null) {
  if (estado && COLOR_ESTADO[estado]) cell.font = { color: { argb: COLOR_ESTADO[estado] }, bold: true };
}

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

/**
 * Listado de socios (todos, o solo los ids indicados). Dos hojas:
 *  - "Socios": una fila por socio, con autofiltro en la cabecera (el jefe puede
 *    quedarse con "los de 35 €" desde el propio Excel) y el desglose del último
 *    pago (si un cobro juntó gimnasio + karate, se ve de qué se compone).
 *  - "Por cuota": los mismos socios agrupados por el importe de su último pago,
 *    con recuento por grupo — la foto de fin de mes a simple vista.
 */
export async function libroSocios(ids?: number[]): Promise<Buffer> {
  let filas: SocioRow[];
  const ORDEN = "ORDER BY apellidos COLLATE NOCASE, nombre COLLATE NOCASE";
  if (ids && ids.length) {
    const ph = ids.map(() => "?").join(",");
    filas = db.prepare(`SELECT * FROM socios WHERE id IN (${ph}) ${ORDEN}`).all(...ids) as SocioRow[];
  } else {
    filas = db.prepare(`SELECT * FROM socios ${ORDEN}`).all() as SocioRow[];
  }
  const socios = filas.map((s) => socioConResumen(s));

  // "Gimnasio 30 € + Karate 32 €": de qué actividades se compone el último cobro.
  const lineasStmt = db.prepare("SELECT actividad, importe FROM pago_lineas WHERE pago_id = ? ORDER BY id");
  const detalleUltimoPago = (s: (typeof socios)[number]): string =>
    s.ultimoPago
      ? (lineasStmt.all(s.ultimoPago.id) as { actividad: string; importe: number }[])
          .map((l) => `${cap(l.actividad)} ${importeTxt(l.importe)}`)
          .join(" + ")
      : "";
  const actividadesTxt = (s: (typeof socios)[number]): string =>
    s.suscripciones.filter((x) => x.activa).map((x) => cap(x.actividad)).join(", ");

  const wb = new ExcelJS.Workbook();

  // Hoja 1 · Socios (una fila por socio, con autofiltro)
  const ws = wb.addWorksheet("Socios");
  ws.columns = [
    { header: "Apellidos", key: "apellidos", width: 22 },
    { header: "Nombre", key: "nombre", width: 18 },
    { header: "DNI/NIF", key: "dni", width: 14 },
    { header: "Sexo", key: "sexo", width: 10 },
    { header: "Teléfono", key: "tel", width: 14 },
    { header: "Email", key: "email", width: 26 },
    { header: "Estado", key: "estado", width: 10 },
    { header: "Alta", key: "alta", width: 12 },
    { header: "Actividades activas", key: "acts", width: 26 },
    { header: "Cuota activa", key: "cuota", width: 13, style: { numFmt: EUR } },
    { header: "Último pago", key: "ultimoPago", width: 13, style: { numFmt: EUR } },
    { header: "Detalle último pago", key: "ultimoPagoDetalle", width: 30 },
    { header: "Fecha último pago", key: "ultimoPagoFecha", width: 17 },
    { header: "Estado cuota", key: "cuotaEstado", width: 14 },
  ];
  socios.forEach((s, i) => {
    const activas = s.suscripciones.filter((x) => x.activa);
    const row = ws.addRow({
      apellidos: s.apellidos ?? "",
      nombre: s.nombre,
      dni: s.dni ?? "",
      sexo: sexoTxt(s.sexo),
      tel: s.telefono ?? "",
      email: s.email ?? "",
      estado: s.estado === "baja" ? "Baja" : "Activo",
      alta: ddmmaaaa(s.fechaAlta),
      acts: actividadesTxt(s),
      cuota: activas.reduce((acc, x) => acc + x.importe, 0),
      ultimoPago: s.ultimoPago ? s.ultimoPago.total : "",
      ultimoPagoDetalle: detalleUltimoPago(s),
      ultimoPagoFecha: s.ultimoPago ? ddmmaaaa(s.ultimoPago.fecha) : "",
      cuotaEstado: s.estadoResumen ? ESTADO_TXT[s.estadoResumen] : "Sin cuotas",
    });
    pintaEstadoCuota(row.getCell("cuotaEstado"), s.estadoResumen);
    if (i % 2 === 1) for (let c = 1; c <= ws.columns.length; c++) row.getCell(c).fill = FILL_ZEBRA;
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };
  estilaCabecera(ws);

  // Hoja 2 · Por cuota (agrupados por el importe del último pago)
  const hoja = wb.addWorksheet("Por cuota");
  [22, 18, 14, 26, 30, 17, 14].forEach((w, i) => (hoja.getColumn(i + 1).width = w));
  const NCOLS = 7;
  const filaTitulo = (texto: string, opts: { size?: number; fill?: ExcelJS.Fill; gris?: boolean } = {}) => {
    const r = hoja.addRow([texto]);
    for (let c = 1; c <= NCOLS; c++) {
      if (opts.fill) r.getCell(c).fill = opts.fill;
    }
    hoja.mergeCells(r.number, 1, r.number, NCOLS);
    r.getCell(1).font = opts.gris ? { color: { argb: "FF808080" }, size: 10 } : { bold: true, size: opts.size ?? 12 };
    return r;
  };

  filaTitulo("Socios por último pago", { size: 14 });
  filaTitulo(`${socios.length} socio${socios.length === 1 ? "" : "s"} · generado el ${ddmmaaaa(hoyISO())}`, { gris: true });

  // Grupos: cada importe de último pago → sus socios; aparte, los sin cobro.
  const grupos = new Map<number, typeof socios>();
  const sinCobro: typeof socios = [];
  for (const s of socios) {
    if (!s.ultimoPago) {
      sinCobro.push(s);
      continue;
    }
    const arr = grupos.get(s.ultimoPago.total) ?? [];
    arr.push(s);
    grupos.set(s.ultimoPago.total, arr);
  }
  const importes = [...grupos.keys()].sort((a, b) => a - b);

  // Resumen arriba: cuántos socios hay en cada cuota.
  hoja.addRow([]);
  const cab = hoja.addRow(["Último pago", "Socios"]);
  for (const c of [1, 2]) {
    cab.getCell(c).font = { bold: true, color: { argb: "FFFFFFFF" } };
    cab.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F5BB8" } };
  }
  for (const imp of importes) hoja.addRow([importeTxt(imp), grupos.get(imp)!.length]);
  if (sinCobro.length) hoja.addRow(["Sin cobros", sinCobro.length]);

  // Una sección por importe, con sus socios (ya vienen ordenados por apellido).
  const seccion = (titulo: string, lista: typeof socios) => {
    hoja.addRow([]);
    filaTitulo(titulo, { fill: FILL_GRUPO });
    const sub = hoja.addRow(["Apellidos", "Nombre", "Teléfono", "Actividades activas", "Detalle último pago", "Fecha último pago", "Estado cuota"]);
    for (let c = 1; c <= NCOLS; c++) {
      sub.getCell(c).font = { bold: true };
      sub.getCell(c).fill = FILL_SUBCAB;
    }
    for (const s of lista) {
      const r = hoja.addRow([
        s.apellidos ?? "",
        s.nombre + (s.estado === "baja" ? " (baja)" : ""),
        s.telefono ?? "",
        actividadesTxt(s),
        detalleUltimoPago(s),
        s.ultimoPago ? ddmmaaaa(s.ultimoPago.fecha) : "",
        s.estadoResumen ? ESTADO_TXT[s.estadoResumen] : "Sin cuotas",
      ]);
      pintaEstadoCuota(r.getCell(NCOLS), s.estadoResumen);
    }
  };
  for (const imp of importes) seccion(`${importeTxt(imp)} · ${grupos.get(imp)!.length} socio${grupos.get(imp)!.length === 1 ? "" : "s"}`, grupos.get(imp)!);
  if (sinCobro.length) seccion(`Sin cobros registrados · ${sinCobro.length} socio${sinCobro.length === 1 ? "" : "s"}`, sinCobro);

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
    ["Socio", socio.nombreCompleto],
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
