import { useState } from "react";
import { Modal } from "./Modal.tsx";
import { rangoDePreset, rangoDeAnio, type RangoFecha, type PresetFecha } from "../filtros.ts";
import { fecha as fmtFecha, hoyISO } from "../format.ts";

const PRESETS: { k: PresetFecha; t: string }[] = [
  { k: "hoy", t: "Hoy" },
  { k: "ayer", t: "Ayer" },
  { k: "ult7", t: "Últimos 7 días" },
  { k: "semana", t: "Esta semana" },
  { k: "mes", t: "Este mes" },
  { k: "anio", t: "Este año" },
];

const CAL = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, verticalAlign: "-2px" }} aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="1" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="16" y1="2" x2="16" y2="6" />
  </svg>
);

export function FiltroFecha({ rango, onChange }: { rango: RangoFecha; onChange: (r: RangoFecha) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [mas, setMas] = useState(false);
  const [desde, setDesde] = useState(rango.desde ?? "");
  const [hasta, setHasta] = useState(rango.hasta ?? "");

  const activo = !!(rango.desde || rango.hasta);
  const etiqueta = activo
    ? `Alta: ${rango.desde ? fmtFecha(rango.desde) : "…"} – ${rango.hasta ? fmtFecha(rango.hasta) : "…"}`
    : "Fecha de alta";

  function preset(k: PresetFecha) {
    onChange(rangoDePreset(k, hoyISO()));
    setAbierto(false);
  }
  function aplicar() {
    onChange({ desde: desde || null, hasta: hasta || null });
    setAbierto(false);
  }
  function quitar() {
    onChange({ desde: null, hasta: null });
    setDesde("");
    setHasta("");
    setAbierto(false);
  }

  const anio = Number(hoyISO().slice(0, 4));
  const anios = [anio, anio - 1, anio - 2, anio - 3];

  return (
    <>
      <button
        className={"chip" + (activo ? " on" : "")}
        onClick={() => {
          setDesde(rango.desde ?? "");
          setHasta(rango.hasta ?? "");
          setAbierto(true);
        }}
      >
        {CAL}
        {etiqueta}
      </button>
      {abierto && (
        <Modal
          titulo="Filtrar por fecha de alta"
          onCerrar={() => setAbierto(false)}
          pie={
            <>
              <button className="btn ghost" onClick={quitar}>
                Quitar fecha
              </button>
              <button className="btn" onClick={() => setAbierto(false)}>
                Cerrar
              </button>
            </>
          }
        >
          <div className="modal-body">
            <span className="chip-label" style={{ display: "block", marginBottom: 8 }}>Periodos rápidos</span>
            <div className="chips">
              {PRESETS.map((p) => (
                <button key={p.k} className="chip" onClick={() => preset(p.k)}>
                  {p.t}
                </button>
              ))}
            </div>

            <button className="btn ghost sm" style={{ marginTop: 14 }} onClick={() => setMas((m) => !m)}>
              {mas ? "− Menos opciones" : "+ Más opciones (año o rango exacto)"}
            </button>

            {mas && (
              <div style={{ marginTop: 14, borderTop: "1.5px solid var(--linea)", paddingTop: 14 }}>
                <div className="field">
                  <label>Un año entero</label>
                  <div className="chips">
                    {anios.map((a) => (
                      <button key={a} className="chip" onClick={() => { onChange(rangoDeAnio(a)); setAbierto(false); }}>
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="row2">
                  <div className="field">
                    <label>Desde</label>
                    <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Hasta</label>
                    <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
                  </div>
                </div>
                <button className="btn primary sm" onClick={aplicar}>
                  Aplicar rango exacto
                </button>
                <div className="hint" style={{ marginTop: 8 }}>Puedes poner solo “Desde”, solo “Hasta”, o ambos.</div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
