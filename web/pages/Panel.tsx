import { useEffect, useRef, useState } from "react";
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

/** Contador animado: sube (o baja) hasta el objetivo con easing suave.
 *  Usa setTimeout (no rAF) para funcionar también en pestañas en segundo plano,
 *  y respeta `prefers-reduced-motion`. Al terminar muestra el valor exacto. */
function useContador(objetivo: number): number {
  const [valor, setValor] = useState(0);
  const actual = useRef(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      actual.current = objetivo;
      setValor(objetivo);
      return;
    }
    const desde = actual.current;
    const t0 = performance.now();
    const dur = 750;
    let timer = 0;
    const paso = () => {
      const p = Math.min(1, (performance.now() - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      const v = p < 1 ? Math.round(desde + (objetivo - desde) * e) : objetivo;
      actual.current = v;
      setValor(v);
      if (p < 1) timer = window.setTimeout(paso, 16);
    };
    paso();
    return () => window.clearTimeout(timer);
  }, [objetivo]);
  return valor;
}

export function Panel() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [cobrar, setCobrar] = useState<DashItem | null>(null);
  const [avisoErr, setAvisoErr] = useState("");
  const [avisadoId, setAvisadoId] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [verIngresos, setVerIngresos] = useState(() => localStorage.getItem("gym_ver_ingresos") === "1");
  const avisadoTimer = useRef<number>(0);
  const nav = useNavigate();

  // Contadores animados de los marcadores (los hooks van antes de cualquier return condicional).
  const cPorCobrar = useContador(data?.resumen.porCobrar ?? 0);
  const cPronto = useContador(data?.resumen.pronto ?? 0);
  const cAldia = useContador(data?.resumen.aldia ?? 0);
  const totalIngresos = Math.round(data?.ingresosMes.total ?? 0);
  const cIngresos = useContador(verIngresos ? totalIngresos : 0);

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
  useEffect(() => () => window.clearTimeout(avisadoTimer.current), []);

  async function avisar(i: DashItem) {
    if (enviando) return; // evita doble envío por doble clic
    setEnviando(true);
    setAvisoErr("");
    try {
      await api.avisarEmail(i.socioId);
      // Confirmación en el propio botón ("✓ Enviado"), sin banners ni popups.
      window.clearTimeout(avisadoTimer.current);
      setAvisadoId(i.suscripcionId);
      avisadoTimer.current = window.setTimeout(() => setAvisadoId(null), 2600);
    } catch (e: any) {
      setAvisoErr(e.message);
    } finally {
      setEnviando(false);
    }
  }

  if (error) return <div className="error-banner">{error}</div>;
  if (!data) return <div className="center-box">Cargando…</div>;

  const { resumen, ingresosMes } = data;
  // Desglose presentacional de "Por cobrar" (sin pagar vs. atrasado), calculado en cliente.
  const sinPagar = data.porCobrar.filter((i) => i.estado === "pendiente").length;
  const atrasado = data.porCobrar.filter((i) => i.estado === "atrasado").length;

  return (
    <>
      {/* Cabecera compacta: friso del templo (misma esencia, la mitad de alto) */}
      <div className="hero hero-compacta">
        <svg className="templo" viewBox="0 0 800 244" fill="currentColor" aria-hidden="true">
          <path d="M400 16 L648 100 H152 Z" />
          <rect x="152" y="106" width="496" height="16" />
          <rect x="179" y="128" width="22" height="82" />
          <rect x="239" y="128" width="22" height="82" />
          <rect x="299" y="128" width="22" height="82" />
          <rect x="359" y="128" width="22" height="82" />
          <rect x="419" y="128" width="22" height="82" />
          <rect x="479" y="128" width="22" height="82" />
          <rect x="539" y="128" width="22" height="82" />
          <rect x="599" y="128" width="22" height="82" />
          <rect x="150" y="214" width="500" height="16" />
          <rect x="138" y="233" width="524" height="8" opacity="0.5" />
        </svg>
        <div className="hero-marca">
          <div className="eyebrow">Bienvenido a tu templo</div>
          <h1 className="wordmark">GymGrecia</h1>
        </div>
        <div className="hero-dcha">
          <div className="hero-fecha">
            {fecha(data.hoy)} · {resumen.totalActivos} socios activos
          </div>
          <AyudaPanel />
        </div>
      </div>

      <div className="lienzo">
      {avisoErr && <div className="error-banner">{avisoErr}</div>}
      <div className="stat-grid">
        <div className="stat rojo clic" onClick={() => nav("/socios?cuota=pendiente")} title="Ver estos socios">
          <div className="bar" />
          <div className="label">Por cobrar</div>
          <div className="value">{cPorCobrar}</div>
          {resumen.porCobrar > 0 && (
            <div className="desglose">
              <span className="badge morado">Sin pagar {sinPagar}</span>
              <span className="badge rojo">Atrasado {atrasado}</span>
            </div>
          )}
        </div>
        <div className="stat ambar clic" onClick={() => nav("/socios?cuota=pronto")} title="Ver estos socios">
          <div className="bar" />
          <div className="label">Vencen pronto</div>
          <div className="value">{cPronto}</div>
          <div className="nota">En 7 días o menos</div>
        </div>
        <div className="stat verde clic" onClick={() => nav("/socios?cuota=aldia")} title="Ver estos socios">
          <div className="bar" />
          <div className="label">Al día</div>
          <div className="value">{cAldia}</div>
          <div className="nota">Cuotas en regla</div>
        </div>
        <div className="stat oro">
          <div className="bar" />
          <div className="label">
            Ingresos del mes
            <button className="ojo-btn" onClick={toggleIngresos} title={verIngresos ? "Ocultar" : "Mostrar"} aria-label={verIngresos ? "Ocultar" : "Mostrar"}>
              {verIngresos ? OJO_ABIERTO : OJO_CERRADO}
            </button>
          </div>
          <div className="value">
            {verIngresos ? (
              <span key="visible" className="fade-suave cifra">
                {cIngresos === totalIngresos ? euros(ingresosMes.total) : euros(cIngresos)}
              </span>
            ) : (
              <span key="oculto" className="valor-oculto fade-suave">••••• €</span>
            )}
          </div>
          <div className="nota">Cobrado este mes</div>
        </div>
      </div>

      <div className="cols">
        <Columna titulo="Por cobrar / atrasados" color="rojo" items={data.porCobrar} onCobrar={setCobrar} onAvisar={avisar} avisadoId={avisadoId} verMas="/socios?cuota=pendiente" vacio="Nadie pendiente. 🎉" />
        <Columna titulo="Vencen pronto" color="ambar" items={data.pronto} onCobrar={setCobrar} onAvisar={avisar} avisadoId={avisadoId} verMas="/socios?cuota=pronto" vacio="Nada vence esta semana." />
        <Columna titulo="Al día" color="verde" items={data.aldia} onCobrar={setCobrar} onAvisar={avisar} avisadoId={avisadoId} verMas="/socios?cuota=aldia" vacio="Sin cuotas al día todavía." />
      </div>

      {ingresosMes.porActividad.length > 0 && (
        <div className="card card-pad ingresos-card" style={{ marginTop: 20 }}>
          <div className="section-title">
            Ingresos de este mes por actividad
            <button className="ojo-btn" onClick={toggleIngresos} title={verIngresos ? "Ocultar" : "Mostrar"} aria-label={verIngresos ? "Ocultar" : "Mostrar"}>
              {verIngresos ? OJO_ABIERTO : OJO_CERRADO}
            </button>
          </div>
          {verIngresos ? (
            <div className="tag-list" key="visible">
              {ingresosMes.porActividad.map((a) => (
                <span key={a.actividad} className="pill-act" style={{ fontSize: 13, padding: "5px 12px" }}>
                  {capitalizar(a.actividad)}: <strong className="cifra">{euros(a.total)}</strong>
                </span>
              ))}
            </div>
          ) : (
            <div className="muted oculto-linea" key="oculto" style={{ fontSize: 13 }}>Oculto · pulsa el ojo para mostrar.</div>
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
  avisadoId,
  verMas,
  vacio,
}: {
  titulo: string;
  color: string;
  items: DashItem[];
  onCobrar: (i: DashItem) => void;
  onAvisar: (i: DashItem) => void;
  avisadoId: number | null;
  verMas: string;
  vacio: string;
}) {
  const MAX = 6; // el panel es para actuar, no para listar todo: mostramos los más urgentes
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
            <strong className="cifra">{euros(i.importe)}</strong>
          </div>
          <div className="meta">
            <span className="pill-act">{capitalizar(i.actividad)}</span>
            <span className={"badge " + colorEstado(i.estado)}>
              <i className="bdot" />
              {estadoTexto(i.estado, i.dias)}
            </span>
            {i.etiqueta && <span className="muted">{i.etiqueta}</span>}
          </div>
          <div className="acciones">
            <button className="btn primary sm" onClick={() => onCobrar(i)}>
              Cobrar
            </button>
            {i.estado !== "aldia" && (
              <button className={"btn sm" + (avisadoId === i.suscripcionId ? " avisado" : "")} onClick={() => onAvisar(i)}>
                {avisadoId === i.suscripcionId ? "✓ Enviado" : "Avisar"}
              </button>
            )}
            <span className="item-fecha">{i.pagadoHasta ? `hasta ${fecha(i.pagadoHasta)}` : `alta ${fecha(i.fechaAlta)}`}</span>
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
