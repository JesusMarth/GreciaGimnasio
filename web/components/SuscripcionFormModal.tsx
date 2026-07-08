import { useEffect, useState } from "react";
import { Modal } from "./Modal.tsx";
import { api, ACTIVIDADES, METODOS } from "../api.ts";
import { capitalizar, euros, hoyISO } from "../format.ts";
import type { Suscripcion, Tarifa } from "../types.ts";

interface Props {
  socioId: number;
  suscripcion?: Suscripcion; // si viene, es edicion
  onCerrar: () => void;
  onHecho: () => void;
}

// Cómo arranca la actividad nueva (solo en el alta):
//  - pendiente: sin pagos; el socio saldrá como "Sin pagar" hasta el primer cobro.
//  - cobrar   : registra AHORA el primer pago real → cuenta en Ingresos e historial.
//  - papel    : ya estaba pagado fuera de la app (archivador) → solo cuadra el estado.
type Arranque = "pendiente" | "cobrar" | "papel";

export function SuscripcionFormModal({ socioId, suscripcion, onCerrar, onHecho }: Props) {
  const [actividad, setActividad] = useState(suscripcion?.actividad ?? "gimnasio");
  const [etiqueta, setEtiqueta] = useState(suscripcion?.etiqueta ?? "");
  const [importe, setImporte] = useState<number>(suscripcion?.importe ?? 0);
  const [periodicidad, setPeriodicidad] = useState(suscripcion?.periodicidad ?? "mensual");
  const [pagadoHasta, setPagadoHasta] = useState(suscripcion?.pagadoHasta ?? "");
  const [activa, setActiva] = useState(suscripcion?.activa ?? true);
  const [arranque, setArranque] = useState<Arranque>("pendiente");
  const [fechaCobro, setFechaCobro] = useState(hoyISO());
  const [metodo, setMetodo] = useState("efectivo");
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!suscripcion) api.tarifas().then(setTarifas).catch(() => {});
  }, [suscripcion]);

  function aplicarTarifa(id: string) {
    const t = tarifas.find((x) => x.id === Number(id));
    if (!t) return;
    setActividad(t.actividad);
    setEtiqueta(t.nombre);
    setImporte(t.importe);
    setPeriodicidad(t.periodicidad);
  }

  async function guardar() {
    if (!actividad.trim()) {
      setError("La actividad es obligatoria.");
      return;
    }
    if (!Number.isFinite(importe) || importe < 0) {
      setError("Importe no válido.");
      return;
    }
    if (!suscripcion && arranque === "papel" && !pagadoHasta) {
      setError("Pon hasta cuándo estaba pagado (o elige otra opción).");
      return;
    }
    setGuardando(true);
    setError("");
    const datos: Record<string, unknown> = {
      actividad,
      etiqueta: etiqueta.trim() || null,
      importe: Number(importe),
      periodicidad,
      activa,
    };
    if (suscripcion) {
      datos.pagadoHasta = pagadoHasta || null;
    } else {
      // El alta manda pagadoHasta o cobroInicial según el arranque elegido, nunca
      // los dos: así no se puede duplicar el mismo dinero (a mano Y como cobro).
      datos.pagadoHasta = arranque === "papel" ? pagadoHasta : null;
      if (arranque === "cobrar") datos.cobroInicial = { metodo, fecha: fechaCobro };
    }
    try {
      if (suscripcion) await api.editarSuscripcion(suscripcion.id, datos);
      else await api.crearSuscripcion(socioId, datos);
      onHecho();
    } catch (e: any) {
      setError(e.message);
      setGuardando(false);
    }
  }

  // La actividad es un conjunto conocido (ACTIVIDADES). Si se edita una con un
  // valor antiguo fuera de la lista, lo añadimos para no perderlo en el select.
  const opcionesActividad =
    actividad && !ACTIVIDADES.includes(actividad) ? [...ACTIVIDADES, actividad] : ACTIVIDADES;

  return (
    <Modal
      titulo={suscripcion ? "Editar actividad" : "Añadir actividad"}
      onCerrar={onCerrar}
      pie={
        <>
          <button className="btn ghost" onClick={onCerrar}>
            Cancelar
          </button>
          <button className="btn primary" onClick={guardar} disabled={guardando}>
            {guardando
              ? "Guardando…"
              : !suscripcion && arranque === "cobrar"
                ? `Guardar y cobrar ${euros(Number(importe) || 0)}`
                : "Guardar"}
          </button>
        </>
      }
    >
      <div className="modal-body">
        {error && <div className="error-banner">{error}</div>}

        {!suscripcion && tarifas.length > 0 && (
          <div className="field">
            <label>Partir de una tarifa (opcional)</label>
            <select defaultValue="" onChange={(e) => aplicarTarifa(e.target.value)}>
              <option value="">— elegir tarifa para precargar —</option>
              {tarifas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre} · {t.importe}€ ({capitalizar(t.actividad)})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="row2">
          <div className="field">
            <label>Actividad *</label>
            <select value={actividad} onChange={(e) => setActividad(e.target.value)}>
              {opcionesActividad.map((a) => (
                <option key={a} value={a}>
                  {capitalizar(a)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Importe (€) *</label>
            <input type="number" step="0.01" min="0" value={importe} onChange={(e) => setImporte(Number(e.target.value))} />
          </div>
        </div>

        <div className="field">
          <label>Etiqueta / descripción</label>
          <input value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} placeholder="p. ej. Karate juvenil, Gimnasio familiar…" />
        </div>

        <div className="field">
          <label>Tipo</label>
          <select value={periodicidad} onChange={(e) => setPeriodicidad(e.target.value)}>
            <option value="mensual">Cuota mensual</option>
            <option value="bono">Bono / periodo</option>
          </select>
        </div>

        {!suscripcion && (
          <>
            <div className="field">
              <label>Primer pago</label>
              <div className="chips" role="group" aria-label="Primer pago">
                <button type="button" className={"chip" + (arranque === "pendiente" ? " on" : "")} onClick={() => setArranque("pendiente")}>
                  Queda pendiente
                </button>
                <button type="button" className={"chip" + (arranque === "cobrar" ? " on" : "")} onClick={() => setArranque("cobrar")}>
                  Cobrar ahora
                </button>
                <button type="button" className={"chip" + (arranque === "papel" ? " on" : "")} onClick={() => setArranque("papel")}>
                  Ya estaba pagado
                </button>
              </div>
            </div>

            {arranque === "pendiente" && (
              <div className="hint">Saldrá como «Sin pagar» hasta que registres su primer cobro.</div>
            )}

            {arranque === "cobrar" && (
              <>
                <div className="row2">
                  <div className="field">
                    <label>Fecha del cobro</label>
                    <input type="date" value={fechaCobro} onChange={(e) => setFechaCobro(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Método</label>
                    <select value={metodo} onChange={(e) => setMetodo(e.target.value)}>
                      {METODOS.map((m) => (
                        <option key={m} value={m}>
                          {capitalizar(m)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="hint">
                  Se apunta un cobro de {euros(Number(importe) || 0)} (1 {periodicidad === "bono" ? "bono" : "mes"}) que contará en
                  Ingresos y en su historial, con recibo. ¿Te paga varios meses? Cóbralos luego con «Registrar pago».
                </div>
              </>
            )}

            {arranque === "papel" && (
              <>
                <div className="field">
                  <label>Pagado hasta *</label>
                  <input type="date" value={pagadoHasta} onChange={(e) => setPagadoHasta(e.target.value)} />
                </div>
                <div className="hint">
                  Para socios que ya venían pagados de fuera de la app (archivador en papel). Solo cuadra su estado: NO se
                  apunta ningún cobro y ese dinero no saldrá en Ingresos.
                </div>
              </>
            )}
          </>
        )}

        {suscripcion && (
          <>
            <div className="field">
              <label>Pagado hasta</label>
              <input type="date" value={pagadoHasta} onChange={(e) => setPagadoHasta(e.target.value)} />
            </div>
            <div className="hint">
              Cambiar esta fecha a mano solo cuadra el estado: no apunta ningún cobro. Para cobrar de verdad usa «Registrar
              pago».
            </div>
            <div className="field">
              <label>
                <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} style={{ width: "auto", marginRight: 8 }} />
                Activa (cuenta para los avisos de cobro)
              </label>
            </div>
          </>
        )}
        <div className="hint">
          El importe es libre: pon lo que pague de verdad (con su oferta, descuento familiar o por edad ya aplicados).
        </div>
      </div>
    </Modal>
  );
}
