import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.ts";
import { euros, fecha, estadoTexto, colorEstado, capitalizar } from "../format.ts";
import { PagoModal } from "../components/PagoModal.tsx";
import type { Dashboard, DashItem } from "../types.ts";
import { AyudaPanel } from "../components/Ayuda.tsx";

const OJO_ABIERTO = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const OJO_CERRADO = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-11-7-11-7a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

export function Panel() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [cobrar, setCobrar] = useState<DashItem | null>(null);
  const [aviso, setAviso] = useState("");
  const [avisoErr, setAvisoErr] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [verIngresos, setVerIngresos] = useState(() => localStorage.getItem("gym_ver_ingresos") === "1");
  const nav = useNavigate();

  function toggleIngresos() {
    setVerIngresos((v) => {
      localStorage.setItem("gym_ver_ingresos", v ? "0" : "1");
      return !v;
    });
  }

  function recargar() {
    api.dashboard().then(setData).catch((e) => setError(e.message));
  }
  useEffect(recargar, []);

  async function avisar(i: DashItem) {
    if (enviando) return; // evita doble envío por doble clic
    setEnviando(true);
    setAviso("");
    setAvisoErr("");
    try {
      const r = await api.avisarEmail(i.socioId);
      setAviso(`Aviso enviado a ${r.email} (${i.socioNombre}).`);
    } catch (e: any) {
      setAvisoErr(e.message);
    } finally {
      setEnviando(false);
    }
  }

  if (error) return <div className="error-banner">{error}</div>;
  if (!data) return <div className="center-box">Cargando…</div>;

  const { resumen, ingresosMes } = data;

  return (
    <>
      <div className="hero">
        <svg className="templo" viewBox="0 0 800 230" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M400 12 L624 88 L176 88 Z" strokeWidth="6" />
          <path d="M180 98 H620" strokeWidth="11" />
          <path d="M210 106 V198 M258 106 V198 M306 106 V198 M354 106 V198 M402 106 V198 M450 106 V198 M498 106 V198 M546 106 V198 M594 106 V198" strokeWidth="7" />
          <path d="M168 202 H632" strokeWidth="11" />
          <path d="M156 216 H644" strokeWidth="8" opacity="0.6" />
        </svg>
        <div className="eyebrow">Bienvenido a tu templo</div>
        <h1 className="wordmark">GymGrecia</h1>
        <div className="lema">Cada socio y cada cuota, en su sitio. Esto es lo que hay hoy.</div>
        <div className="hero-fecha">
          {fecha(data.hoy)} · {resumen.totalActivos} socios activos
        </div>
      </div>

      <div className="lienzo">
      {avisoErr && <div className="error-banner">{avisoErr}</div>}
      {aviso && <div className="ok-banner">{aviso}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <AyudaPanel />
      </div>
      <div className="stat-grid">
        <div className="stat rojo clic" onClick={() => nav("/socios?cuota=pendiente")} title="Ver estos socios">
          <div className="bar" />
          <div className="label">Por cobrar</div>
          <div className="value">{resumen.porCobrar}</div>
        </div>
        <div className="stat ambar clic" onClick={() => nav("/socios?cuota=pronto")} title="Ver estos socios">
          <div className="bar" />
          <div className="label">Vencen pronto</div>
          <div className="value">{resumen.pronto}</div>
        </div>
        <div className="stat verde clic" onClick={() => nav("/socios?cuota=aldia")} title="Ver estos socios">
          <div className="bar" />
          <div className="label">Al día</div>
          <div className="value">{resumen.aldia}</div>
        </div>
        <div className="stat azul">
          <div className="bar" />
          <div className="label">
            Ingresos del mes
            <button className="ojo-btn" onClick={toggleIngresos} title={verIngresos ? "Ocultar" : "Mostrar"} aria-label={verIngresos ? "Ocultar ingresos" : "Mostrar ingresos"}>
              {verIngresos ? OJO_ABIERTO : OJO_CERRADO}
            </button>
          </div>
          <div className="value">{verIngresos ? euros(ingresosMes.total) : <span className="valor-oculto">••••• €</span>}</div>
        </div>
      </div>

      <div className="cols">
        <Columna titulo="Por cobrar / atrasados" color="rojo" items={data.porCobrar} onCobrar={setCobrar} onAvisar={avisar} verMas="/socios?cuota=pendiente" vacio="Nadie pendiente. 🎉" />
        <Columna titulo="Vencen pronto" color="ambar" items={data.pronto} onCobrar={setCobrar} onAvisar={avisar} verMas="/socios?cuota=pronto" vacio="Nada vence esta semana." />
        <Columna titulo="Al día" color="verde" items={data.aldia} onCobrar={setCobrar} onAvisar={avisar} verMas="/socios?cuota=aldia" vacio="Sin cuotas al día todavía." />
      </div>

      {ingresosMes.porActividad.length > 0 && (
        <div className="card card-pad ingresos-card" style={{ marginTop: 22 }}>
          <div className="section-title">
            Ingresos de este mes por actividad
            <button className="ojo-btn" onClick={toggleIngresos} title={verIngresos ? "Ocultar" : "Mostrar"} aria-label={verIngresos ? "Ocultar" : "Mostrar"}>
              {verIngresos ? OJO_ABIERTO : OJO_CERRADO}
            </button>
          </div>
          {verIngresos ? (
            <div className="tag-list">
              {ingresosMes.porActividad.map((a) => (
                <span key={a.actividad} className="pill-act" style={{ fontSize: 13, padding: "5px 12px" }}>
                  {capitalizar(a.actividad)}: <strong>{euros(a.total)}</strong>
                </span>
              ))}
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 13 }}>Oculto · pulsa el ojo para mostrar.</div>
          )}
        </div>
      )}
      </div>

      {cobrar && (
        <PagoModal
          socioId={cobrar.socioId}
          socioNombre={cobrar.socioNombre}
          suscripcionIdPre={cobrar.suscripcionId}
          onCerrar={() => setCobrar(null)}
          onHecho={() => {
            setCobrar(null);
            recargar();
          }}
        />
      )}
    </>
  );
}

function Columna({
  titulo,
  color,
  items,
  onCobrar,
  onAvisar,
  verMas,
  vacio,
}: {
  titulo: string;
  color: string;
  items: DashItem[];
  onCobrar: (i: DashItem) => void;
  onAvisar: (i: DashItem) => void;
  verMas: string;
  vacio: string;
}) {
  const MAX = 5; // el panel es para actuar, no para listar todo: mostramos los más urgentes
  const visibles = items.slice(0, MAX);
  const resto = items.length - visibles.length;
  return (
    <div>
      <div className="col-head">
        <span className={"dot " + color} /> {titulo}
        <span className="count">{items.length}</span>
      </div>
      {items.length === 0 && <div className="empty-col">{vacio}</div>}
      {visibles.map((i) => (
        <div key={i.suscripcionId} className={"item " + colorEstado(i.estado)}>
          <div className="top">
            <Link to={`/socios/${i.socioId}`} className="nombre">
              {i.socioNombre}
            </Link>
            <strong>{euros(i.importe)}</strong>
          </div>
          <div className="meta">
            <span className="pill-act">{capitalizar(i.actividad)}</span>
            {i.etiqueta && <span>{i.etiqueta}</span>}
          </div>
          <div className="estado-linea">
            <span className="muted">{estadoTexto(i.estado, i.dias)}</span>
            <span className="muted">{i.pagadoHasta ? `hasta ${fecha(i.pagadoHasta)}` : ""}</span>
          </div>
          <div className="acciones">
            <button className="btn primary sm" onClick={() => onCobrar(i)}>
              Cobrar
            </button>
            {i.estado !== "aldia" && (
              <button className="btn sm" onClick={() => onAvisar(i)}>
                Avisar
              </button>
            )}
          </div>
        </div>
      ))}
      {resto > 0 && (
        <Link to={verMas} className="panel-mas">
          + {resto} más →
        </Link>
      )}
    </div>
  );
}
