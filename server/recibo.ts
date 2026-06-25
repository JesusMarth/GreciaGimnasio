import PDFDocument from "pdfkit";
import { resolve } from "node:path";
import { db } from "./db.ts";
import { leerDatosRecibo } from "./config.ts";

const FONT_DIR = resolve(import.meta.dirname, "..", "web", "fonts");

// Paleta de la marca (templo · azul Egeo).
const AZUL = "#1f5bb8";
const AZUL_OSC = "#14294a";
const TINTA = "#16233a";
const SUAVE = "#46546c";
const LINEA = "#c2b69a";

interface LineaPago {
  actividad: string;
  concepto: string | null;
  importe: number;
  periodo_desde: string | null;
  periodo_hasta: string | null;
}

export interface DatosReciboPago {
  numero: string;
  pago: { id: number; fecha: string; metodo: string; total: number; notas: string | null };
  socio: { nombre: string; dni: string | null; email: string | null };
  lineas: LineaPago[];
}

export function ddmmaaaa(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
export const eur = (n: number) => n.toFixed(2).replace(".", ",") + " €";
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Reúne los datos de un pago para el recibo. null si el pago no existe. */
export function datosDelRecibo(pagoId: number): DatosReciboPago | null {
  const pago = db.prepare("SELECT * FROM pagos WHERE id = ?").get(pagoId) as any;
  if (!pago) return null;
  const socio = db.prepare("SELECT nombre, dni, email FROM socios WHERE id = ?").get(pago.socio_id) as any;
  const lineas = db.prepare("SELECT * FROM pago_lineas WHERE pago_id = ?").all(pagoId) as LineaPago[];
  const anio = (pago.fecha || "").slice(0, 4) || "0000";
  return {
    numero: `R-${anio}-${String(pago.id).padStart(4, "0")}`,
    pago,
    socio: socio ?? { nombre: "—", dni: null, email: null },
    lineas,
  };
}

/** Genera el recibo en PDF y lo devuelve como Buffer (para descargar o adjuntar). */
export function generarReciboPDF(pagoId: number): Promise<Buffer> {
  const datos = datosDelRecibo(pagoId);
  if (!datos) return Promise.reject(new Error("Pago no encontrado"));
  const f = leerDatosRecibo();

  return new Promise<Buffer>((resolver, rechazar) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const trozos: Buffer[] = [];
    doc.on("data", (c) => trozos.push(c as Buffer));
    doc.on("end", () => resolver(Buffer.concat(trozos)));
    doc.on("error", rechazar);

    let fuentes = false;
    try {
      doc.registerFont("display", resolve(FONT_DIR, "Cinzel.ttf"));
      doc.registerFont("body", resolve(FONT_DIR, "Archivo.ttf"));
      fuentes = true;
    } catch {
      /* sin fuentes de marca: pdfkit usa Helvetica */
    }
    const FD = fuentes ? "display" : "Helvetica-Bold";
    const FB = fuentes ? "body" : "Helvetica";

    const izq = 50;
    const der = 545;
    const ancho = der - izq;

    // --- Cabecera: emisor (izquierda) ---
    doc.font(FD).fontSize(19).fillColor(AZUL_OSC).text(f.nombre || "Gimnasio", izq, 55, { width: ancho * 0.58 });
    doc.font(FB).fontSize(9).fillColor(SUAVE);
    let yE = doc.y + 2;
    if (f.nif) {
      doc.text(`NIF: ${f.nif}`, izq, yE, { width: ancho * 0.58 });
      yE = doc.y;
    }
    if (f.direccion) doc.text(f.direccion, izq, yE + 1, { width: ancho * 0.58 });

    // --- Cabecera: documento (derecha) ---
    doc.font(FD).fontSize(22).fillColor(AZUL).text((f.tipoDoc || "Recibo").toUpperCase(), izq, 55, { width: ancho, align: "right" });
    doc.font(FB).fontSize(10).fillColor(TINTA).text(`Nº ${datos.numero}`, izq, 84, { width: ancho, align: "right" });
    doc.fillColor(SUAVE).fontSize(9).text(`Fecha: ${ddmmaaaa(datos.pago.fecha)}`, izq, 99, { width: ancho, align: "right" });

    // --- Regla doble ---
    doc.moveTo(izq, 132).lineTo(der, 132).lineWidth(1.2).strokeColor(AZUL).stroke();
    doc.moveTo(izq, 135.5).lineTo(der, 135.5).lineWidth(0.5).strokeColor(LINEA).stroke();

    // --- Recibí de ---
    doc.font(FB).fontSize(8).fillColor(SUAVE).text("RECIBÍ DE", izq, 148, { characterSpacing: 1 });
    doc.font(FD).fontSize(13).fillColor(TINTA).text(datos.socio.nombre, izq, 160);
    if (datos.socio.dni) doc.font(FB).fontSize(9).fillColor(SUAVE).text(`DNI / NIF: ${datos.socio.dni}`, izq, doc.y + 1);

    // --- Tabla de conceptos ---
    let y = 205;
    doc.font(FB).fontSize(8).fillColor(SUAVE);
    doc.text("CONCEPTO", izq, y, { characterSpacing: 1, width: 250 });
    doc.text("PERIODO", izq + 255, y, { characterSpacing: 1, width: 140 });
    doc.text("IMPORTE", der - 100, y, { characterSpacing: 1, width: 100, align: "right" });
    y += 15;
    doc.moveTo(izq, y).lineTo(der, y).lineWidth(0.8).strokeColor(AZUL_OSC).stroke();
    y += 8;

    for (const l of datos.lineas) {
      const concepto = cap(l.actividad) + (l.concepto ? ` · ${l.concepto}` : "");
      const periodo = l.periodo_desde || l.periodo_hasta ? `${ddmmaaaa(l.periodo_desde)} – ${ddmmaaaa(l.periodo_hasta)}` : "—";
      const alto = doc.font(FB).fontSize(10).heightOfString(concepto, { width: 245 });
      doc.fillColor(TINTA).text(concepto, izq, y, { width: 245 });
      doc.font(FB).fontSize(9).fillColor(SUAVE).text(periodo, izq + 255, y + 1, { width: 140 });
      doc.font(FB).fontSize(10).fillColor(TINTA).text(eur(l.importe), der - 100, y, { width: 100, align: "right" });
      y += Math.max(alto, 13) + 9;
      doc.moveTo(izq, y - 5).lineTo(der, y - 5).lineWidth(0.5).strokeColor(LINEA).stroke();
    }

    // --- Totales ---
    const total = datos.pago.total;
    let base = total;
    let cuota = 0;
    if (f.iva === "incluido") {
      base = total / (1 + f.ivaTipo / 100);
      cuota = total - base;
    }
    y += 6;
    const xLbl = der - 240;
    const xVal = der - 110;
    const fila = (lbl: string, val: string, fuerte = false) => {
      doc.font(fuerte ? FD : FB).fontSize(fuerte ? 12 : 10).fillColor(fuerte ? AZUL_OSC : SUAVE).text(lbl, xLbl, y, { width: 130 });
      doc.font(fuerte ? FD : FB).fontSize(fuerte ? 12 : 10).fillColor(fuerte ? AZUL_OSC : TINTA).text(val, xVal, y, { width: 110, align: "right" });
      y += fuerte ? 22 : 16;
    };
    if (f.iva === "incluido") {
      fila("Base imponible", eur(base));
      fila(`IVA (${f.ivaTipo}%)`, eur(cuota));
    }
    fila("TOTAL", eur(total), true);
    if (f.iva === "exento") {
      doc.font(FB).fontSize(8).fillColor(SUAVE).text("Operación exenta de IVA (art. 20 Ley 37/1992).", izq, y, { width: ancho });
      y += 14;
    }

    // --- Forma de pago / notas ---
    y += 10;
    doc.font(FB).fontSize(9).fillColor(SUAVE).text(`Forma de pago: ${cap(datos.pago.metodo)}`, izq, y);
    if (datos.pago.notas) doc.text(`Notas: ${datos.pago.notas}`, izq, doc.y + 2, { width: ancho });

    // --- Pie ---
    const yPie = 772;
    doc.moveTo(izq, yPie).lineTo(der, yPie).lineWidth(0.5).strokeColor(LINEA).stroke();
    doc
      .font(FB)
      .fontSize(8)
      .fillColor(SUAVE)
      .text(f.pie || "Documento justificante de pago.", izq, yPie + 7, { width: ancho, align: "center" });

    doc.end();
  });
}
