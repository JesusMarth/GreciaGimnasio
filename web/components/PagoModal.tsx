import { useEffect, useState } from "react";
import { Modal } from "./Modal.tsx";
import { Desplegable } from "./Desplegable.tsx";
import { api, METODOS } from "../api.ts";
import { euros, hoyISO, capitalizar } from "../format.ts";
import type { Suscripcion } from "../types.ts";

interface LineaUI {
  suscripcionId: number;
  actividad: string;
  etiqueta: string | null;
  importe: number;
  importeBase: number; // precio de 1 mes / 1 bono (para recalcular al cambiar la cantidad)
  meses: number;
  bonos: number; // solo bonos por sesiones: cuántos bonos compra
  esBono: boolean;
  sesionesPorBono: number | null;
  incluir: boolean;
}

interface Props {
  socioId: number;
  socioNombre: string;
  /** Si se indica, solo esa suscripcion empieza marcada. */
  suscripcionIdPre?: number;
  onCerrar: () => void;
  onHecho: () => void;
}

export function PagoModal({ socioId, socioNombre, suscripcionIdPre, onCerrar, onHecho }: Props) {
  const [cargando, setCargando] = useState(true);
  const [lineas, setLineas] = useState<LineaUI[]>([]);
  const [fecha, setFecha] = useState(hoyISO());
  const [metodo, setMetodo] = useState("efectivo");
  const [notas, setNotas] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api
      .socio(socioId)
      .then((s) => {
        const activas = s.suscripciones.filter((x: Suscripcion) => x.activa);
        setLineas(
          activas.map((x) => ({
            suscripcionId: x.id,
            actividad: x.actividad,
            etiqueta: x.etiqueta,
            importe: x.importe,
            importeBase: x.importe,
            meses: 1,
            bonos: 1,
            esBono: x.esBono,
            sesionesPorBono: x.sesionesPorBono,
            incluir: suscripcionIdPre ? x.id === suscripcionIdPre : true,
          }))
        );
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [socioId, suscripcionIdPre]);

  function set(i: number, patch: Partial<LineaUI>) {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  const incluidas = lineas.filter((l) => l.incluir);
  const total = incluidas.reduce((acc, l) => acc + (Number(l.importe) || 0), 0);

  async function guardar() {
    if (incluidas.length === 0) {
      setError("Marca al menos una actividad para cobrar.");
      return;
    }
    setGuardando(true);
    setError("");
    try {
      await api.registrarPago({
        socioId,
        fecha,
        metodo,
        notas: notas.trim() || null,
        lineas: incluidas.map((l) =>
          l.esBono
            ? { suscripcionId: l.suscripcionId, importe: Number(l.importe), bonos: l.bonos }
            : { suscripcionId: l.suscripcionId, importe: Number(l.importe), meses: l.meses }
        ),
      });
      onHecho();
    } catch (e: any) {
      setError(e.message);
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo={`Registrar pago · ${socioNombre}`}
      onCerrar={onCerrar}
      ancho
      pie={
        <>
          <button className="btn ghost" onClick={onCerrar}>
            Cancelar
          </button>
          <button className="btn primary" onClick={guardar} disabled={guardando || cargando}>
            {guardando ? "Guardando…" : `Cobrar ${euros(total)}`}
          </button>
        </>
      }
    >
      <div className="modal-body">
        {error && <div className="error-banner">{error}</div>}
        {cargando ? (
          <div className="center-box">Cargando…</div>
        ) : lineas.length === 0 ? (
          <div className="center-box">Este socio no tiene actividades activas. Añádele una primero.</div>
        ) : (
          <>
            <div className="row2">
              <div className="field">
                <label>Fecha del pago</label>
                <input type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} />
              </div>
              <div className="field">
                <label>Método</label>
                <Desplegable value={metodo} onChange={setMetodo} opciones={METODOS.map((m) => ({ value: m, label: capitalizar(m) }))} />
              </div>
            </div>

            <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-soft)" }}>Conceptos a cobrar</label>
            <div style={{ marginTop: 8 }}>
              {lineas.map((l, i) => (
                <div key={l.suscripcionId} className={"linea-pago" + (l.incluir ? "" : " off")}>
                  <input
                    type="checkbox"
                    checked={l.incluir}
                    style={{ width: "auto" }}
                    onChange={(e) => set(i, { incluir: e.target.checked })}
                  />
                  <div>
                    <div className="lp-nombre">{capitalizar(l.actividad)}</div>
                    {l.esBono ? (
                      <div className="lp-sub">
                        {l.bonos > 1 ? `${l.bonos} bonos · ${l.bonos * (l.sesionesPorBono ?? 0)} sesiones` : `Bono de ${l.sesionesPorBono} sesiones`}
                        {l.etiqueta && l.etiqueta !== `Bono ${l.sesionesPorBono} sesiones` ? ` · ${l.etiqueta}` : ""}
                      </div>
                    ) : (
                      l.etiqueta && <div className="lp-sub">{l.etiqueta}</div>
                    )}
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={l.importe}
                      onChange={(e) => set(i, { importe: Number(e.target.value) })}
                      title="Importe (€)"
                    />
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    {l.esBono ? (
                      <Desplegable
                        value={String(l.bonos)}
                        onChange={(v) => {
                          const n = Number(v);
                          // Al cambiar la cantidad se precarga precio × bonos (editable).
                          set(i, { bonos: n, importe: Math.round(l.importeBase * n * 100) / 100 });
                        }}
                        title="Bonos que compra"
                        opciones={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} bono${n === 1 ? "" : "s"}` }))}
                      />
                    ) : (
                      <Desplegable
                        value={String(l.meses)}
                        onChange={(v) => set(i, { meses: Number(v) })}
                        title="Meses que cubre"
                        opciones={[1, 2, 3, 6, 12].map((m) => ({ value: String(m), label: `${m} mes${m === 1 ? "" : "es"}` }))}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="field" style={{ marginTop: 6 }}>
              <label>Notas (opcional)</label>
              <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="p. ej. pago con retraso, descuento aplicado…" />
            </div>

            <div className="total-line">
              <span>Total</span>
              <span className="cifra">{euros(total)}</span>
            </div>
            <div className="hint">
              Tú escribes el importe acordado de cada concepto. La app no calcula ofertas ni descuentos: guarda lo que cobras.
              {incluidas.some((l) => l.esBono) && " Los bonos suman sus sesiones al contador del socio (no caducan por fecha)."}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
