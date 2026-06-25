import { useEffect, useState } from "react";
import { Modal } from "./Modal.tsx";
import { api, ACTIVIDADES } from "../api.ts";
import { capitalizar } from "../format.ts";
import type { Suscripcion, Tarifa } from "../types.ts";

interface Props {
  socioId: number;
  suscripcion?: Suscripcion; // si viene, es edicion
  onCerrar: () => void;
  onHecho: () => void;
}

export function SuscripcionFormModal({ socioId, suscripcion, onCerrar, onHecho }: Props) {
  const [actividad, setActividad] = useState(suscripcion?.actividad ?? "gimnasio");
  const [etiqueta, setEtiqueta] = useState(suscripcion?.etiqueta ?? "");
  const [importe, setImporte] = useState<number>(suscripcion?.importe ?? 0);
  const [periodicidad, setPeriodicidad] = useState(suscripcion?.periodicidad ?? "mensual");
  const [pagadoHasta, setPagadoHasta] = useState(suscripcion?.pagadoHasta ?? "");
  const [activa, setActiva] = useState(suscripcion?.activa ?? true);
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
    setGuardando(true);
    setError("");
    const datos = {
      actividad,
      etiqueta: etiqueta.trim() || null,
      importe: Number(importe),
      periodicidad,
      pagadoHasta: pagadoHasta || null,
      activa,
    };
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
            {guardando ? "Guardando…" : "Guardar"}
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

        <div className="row2">
          <div className="field">
            <label>Tipo</label>
            <select value={periodicidad} onChange={(e) => setPeriodicidad(e.target.value)}>
              <option value="mensual">Cuota mensual</option>
              <option value="bono">Bono / periodo</option>
            </select>
          </div>
          <div className="field">
            <label>Pagado hasta {suscripcion ? "" : "(si ya tenía pagos)"}</label>
            <input type="date" value={pagadoHasta} onChange={(e) => setPagadoHasta(e.target.value)} />
          </div>
        </div>

        {suscripcion && (
          <div className="field">
            <label>
              <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} style={{ width: "auto", marginRight: 8 }} />
              Activa (cuenta para los avisos de cobro)
            </label>
          </div>
        )}
        <div className="hint">
          El importe es libre: pon lo que pague de verdad (con su oferta, descuento familiar o por edad ya aplicados).
        </div>
      </div>
    </Modal>
  );
}
