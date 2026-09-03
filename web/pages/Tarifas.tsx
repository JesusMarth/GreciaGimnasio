import { useEffect, useState } from "react";
import { api, ACTIVIDADES } from "../api.ts";
import { euros, capitalizar, duracionTxt, opcionesMeses } from "../format.ts";
import { Modal } from "../components/Modal.tsx";
import { Desplegable } from "../components/Desplegable.tsx";
import { useConfirm } from "../components/Confirmar.tsx";
import { AyudaTarifas } from "../components/Ayuda.tsx";
import type { Tarifa } from "../types.ts";

export function Tarifas() {
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState<{ t?: Tarifa } | null>(null);
  const confirmar = useConfirm();

  function recargar() {
    api.tarifas().then(setTarifas).catch((e) => setError(e.message));
  }
  useEffect(recargar, []);

  async function borrar(t: Tarifa) {
    const ok = await confirmar({
      titulo: "Borrar tarifa",
      mensaje: `¿Borrar la tarifa "${t.nombre}"?`,
      confirmar: "Borrar",
      peligro: true,
    });
    if (!ok) return;
    await api.borrarTarifa(t.id);
    recargar();
  }

  return (
    <div className="lienzo">
      <div className="page-head">
        <div>
          <div className="eyebrow">Precios</div>
          <h1>Tarifas</h1>
          <div className="sub">Plantillas de precio para no reescribir importes al dar de alta cuotas.</div>
        </div>
        <div className="btn-row">
          <button className="btn primary" onClick={() => setForm({})}>
            + Nueva tarifa
          </button>
          <AyudaTarifas />
        </div>
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
                  <td className="cifra">{euros(t.importe)}</td>
                  <td className="muted">{t.periodicidad === "bono" ? (t.sesiones ? `Bono · ${t.sesiones} sesiones` : "Bono · sin sesiones (edítala)") : duracionTxt(t.meses || 1)}</td>
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
    </div>
  );
}

function TarifaForm({ tarifa, onCerrar, onHecho }: { tarifa?: Tarifa; onCerrar: () => void; onHecho: () => void }) {
  const [nombre, setNombre] = useState(tarifa?.nombre ?? "");
  const [actividad, setActividad] = useState(tarifa?.actividad ?? "gimnasio");
  const [importe, setImporte] = useState<number>(tarifa?.importe ?? 0);
  const [periodicidad, setPeriodicidad] = useState(tarifa?.periodicidad ?? "mensual");
  const [sesiones, setSesiones] = useState<number>(tarifa?.sesiones ?? 20);
  const [meses, setMeses] = useState<number>(tarifa?.meses ?? 1);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (!nombre.trim() || !actividad.trim()) {
      setError("Nombre y actividad son obligatorios.");
      return;
    }
    if (periodicidad === "bono" && (!Number.isInteger(sesiones) || sesiones < 1)) {
      setError("Indica cuántas sesiones trae el bono.");
      return;
    }
    setGuardando(true);
    setError("");
    const datos = { nombre, actividad, importe: Number(importe), periodicidad, sesiones: periodicidad === "bono" ? sesiones : null, meses: periodicidad === "bono" ? 1 : meses };
    try {
      if (tarifa) await api.editarTarifa(tarifa.id, datos);
      else await api.crearTarifa(datos);
      onHecho();
    } catch (e: any) {
      setError(e.message);
      setGuardando(false);
    }
  }

  const opcionesActividad =
    actividad && !ACTIVIDADES.includes(actividad) ? [...ACTIVIDADES, actividad] : ACTIVIDADES;

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
            <Desplegable value={actividad} onChange={setActividad} opciones={opcionesActividad.map((a) => ({ value: a, label: capitalizar(a) }))} />
          </div>
          <div className="field">
            <label>Importe (€) *</label>
            <input type="number" step="0.01" min="0" value={importe} onChange={(e) => setImporte(Number(e.target.value))} />
          </div>
        </div>
        <div className="row2">
          <div className="field">
            <label>Tipo</label>
            <Desplegable
              value={periodicidad}
              onChange={setPeriodicidad}
              opciones={[
                { value: "mensual", label: "Cuota por tiempo" },
                { value: "bono", label: "Bono de sesiones" },
              ]}
            />
          </div>
          {periodicidad === "bono" ? (
            <div className="field">
              <label>Sesiones por bono *</label>
              <input type="number" step="1" min="1" value={sesiones} onChange={(e) => setSesiones(Number(e.target.value))} />
            </div>
          ) : (
            <div className="field">
              <label>Duración</label>
              <Desplegable value={String(meses)} onChange={(v) => setMeses(Number(v))} opciones={opcionesMeses(meses)} />
            </div>
          )}
        </div>
        {periodicidad !== "bono" && (
          <div className="hint">
            El importe es por {meses === 1 ? "mes" : meses === 12 ? "año" : `${meses} meses`} ({duracionTxt(meses).toLowerCase()}). P. ej. «Anual gimnasio» · 12 meses · 324 €.
          </div>
        )}
      </div>
    </Modal>
  );
}
