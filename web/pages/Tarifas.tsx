import { useEffect, useState } from "react";
import { api, ACTIVIDADES } from "../api.ts";
import { euros, capitalizar } from "../format.ts";
import { Modal } from "../components/Modal.tsx";
import type { Tarifa } from "../types.ts";

export function Tarifas() {
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState<{ t?: Tarifa } | null>(null);

  function recargar() {
    api.tarifas().then(setTarifas).catch((e) => setError(e.message));
  }
  useEffect(recargar, []);

  async function borrar(t: Tarifa) {
    if (!confirm(`¿Borrar la tarifa "${t.nombre}"?`)) return;
    await api.borrarTarifa(t.id);
    recargar();
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Precios</div>
          <h1>Tarifas</h1>
          <div className="sub">Plantillas de precio para no reescribir importes al dar de alta cuotas.</div>
        </div>
        <button className="btn primary" onClick={() => setForm({})}>
          + Nueva tarifa
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card" style={{ overflow: "hidden" }}>
        {tarifas.length === 0 ? (
          <div className="center-box">No hay tarifas. Crea una para precargar precios.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Actividad</th>
                <th>Importe</th>
                <th>Tipo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tarifas.map((t) => (
                <tr key={t.id}>
                  <td className="nombre">{t.nombre}</td>
                  <td>
                    <span className="pill-act">{capitalizar(t.actividad)}</span>
                  </td>
                  <td>{euros(t.importe)}</td>
                  <td className="muted">{t.periodicidad === "bono" ? "Bono" : "Mensual"}</td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn sm" onClick={() => setForm({ t })}>
                      Editar
                    </button>{" "}
                    <button className="btn ghost sm danger" onClick={() => borrar(t)}>
                      Borrar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="hint" style={{ marginTop: 12 }}>
        Las tarifas son orientativas. El precio real de cada socio se fija en su actividad y puede ser distinto (ofertas,
        descuentos familiares o por edad).
      </div>

      {form && <TarifaForm tarifa={form.t} onCerrar={() => setForm(null)} onHecho={() => { setForm(null); recargar(); }} />}
    </>
  );
}

function TarifaForm({ tarifa, onCerrar, onHecho }: { tarifa?: Tarifa; onCerrar: () => void; onHecho: () => void }) {
  const [nombre, setNombre] = useState(tarifa?.nombre ?? "");
  const [actividad, setActividad] = useState(tarifa?.actividad ?? "gimnasio");
  const [importe, setImporte] = useState<number>(tarifa?.importe ?? 0);
  const [periodicidad, setPeriodicidad] = useState(tarifa?.periodicidad ?? "mensual");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (!nombre.trim() || !actividad.trim()) {
      setError("Nombre y actividad son obligatorios.");
      return;
    }
    setGuardando(true);
    setError("");
    const datos = { nombre, actividad, importe: Number(importe), periodicidad };
    try {
      if (tarifa) await api.editarTarifa(tarifa.id, datos);
      else await api.crearTarifa(datos);
      onHecho();
    } catch (e: any) {
      setError(e.message);
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo={tarifa ? "Editar tarifa" : "Nueva tarifa"}
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
        <div className="field">
          <label>Nombre *</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus placeholder="p. ej. Karate juvenil" />
        </div>
        <div className="row2">
          <div className="field">
            <label>Actividad *</label>
            <input list="lista-actividades-t" value={actividad} onChange={(e) => setActividad(e.target.value)} />
            <datalist id="lista-actividades-t">
              {ACTIVIDADES.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </div>
          <div className="field">
            <label>Importe (€) *</label>
            <input type="number" step="0.01" min="0" value={importe} onChange={(e) => setImporte(Number(e.target.value))} />
          </div>
        </div>
        <div className="field">
          <label>Tipo</label>
          <select value={periodicidad} onChange={(e) => setPeriodicidad(e.target.value)}>
            <option value="mensual">Cuota mensual</option>
            <option value="bono">Bono / periodo</option>
          </select>
        </div>
      </div>
    </Modal>
  );
}
