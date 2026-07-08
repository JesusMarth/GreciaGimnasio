import { useEffect, useMemo, useState } from "react";
import { api } from "../api.ts";
import { hoyISO } from "../format.ts";
import { useContador } from "../anim.ts";
import { AyudaMetricas } from "../components/Ayuda.tsx";
import type { Metricas as TMetricas, MetricaMes } from "../types.ts";

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

const MESES_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_LARGOS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const mesCorto = (m: string) => MESES_ES[Number(m.slice(5, 7)) - 1] ?? m;
const mesLargo = (m: string) => `${mesCorto(m)}. ${m.slice(0, 4)}`;
/** Importes de esta pantalla: sin decimales, como el resto de cifras grandes. */
const eur0 = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(Number.isFinite(n) ? n : 0);
/** Etiqueta compacta para ejes: 1234 → "1,2k €". */
function eurosCorto(n: number): string {
  if (n >= 1000) return (n / 1000).toLocaleString("es-ES", { maximumFractionDigits: 1 }) + "k €";
  return Math.round(n) + " €";
}
/** Suma n meses a "YYYY-MM". */
function addMesesStr(m: string, n: number): string {
  const [y, mm] = m.split("-").map(Number);
  const d = new Date(y, mm - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Actividades con su color de marca (los mismos hex que usa web/styles.css).
const ORDEN_ACT = ["gimnasio", "karate", "pilates"] as const;
const ACT: Record<string, { t: string; color: string }> = {
  gimnasio: { t: "Gimnasio", color: "var(--azul-500)" },
  karate: { t: "Karate", color: "var(--terracota)" },
  pilates: { t: "Pilates", color: "var(--oro)" },
};

const MODOS = [
  { k: "ingresos", t: "Ingresos" },
  { k: "socios", t: "Socios" },
  { k: "retencion", t: "Retención" },
];

const FILTROS_KEY = "gym_metricas_filtros_v2";
const MESRE = /^\d{4}-\d{2}$/;

function leerFiltros(): Record<string, any> {
  try {
    return JSON.parse(localStorage.getItem(FILTROS_KEY) || "{}") ?? {};
  } catch {
    return {};
  }
}

function rangoDePreset(k: string, hoyMes: string, dataDesde: string): { desde: string; hasta: string } {
  const y = Number(hoyMes.slice(0, 4));
  if (k === "anio") return { desde: `${y}-01`, hasta: hoyMes };
  if (k === "todo") return { desde: dataDesde, hasta: hoyMes };
  if (/^a\d{4}$/.test(k)) {
    const yy = k.slice(1);
    return { desde: `${yy}-01`, hasta: `${yy}-12` }; // el server lo acota al historial real
  }
  return { desde: addMesesStr(hoyMes, -11), hasta: hoyMes }; // "12m"
}

/** Punto de la gráfica: la fila del mes + su gemelo de hace 12 meses (fantasma). */
interface Punto {
  fila: MetricaMes;
  mes: string;
  valor: number;
  ghostVal: number | null;
}

export function Metricas() {
  const hoyMes = hoyISO().slice(0, 7);
  const guardado = useMemo(leerFiltros, []);

  const [data, setData] = useState<TMetricas | null>(null);
  const [error, setError] = useState("");
  const [preset, setPreset] = useState<string>(() => (typeof guardado.preset === "string" ? guardado.preset : "12m"));
  const [rango, setRango] = useState<{ desde: string; hasta: string }>(() =>
    MESRE.test(guardado.desde) && MESRE.test(guardado.hasta)
      ? { desde: guardado.desde, hasta: guardado.hasta }
      : rangoDePreset("12m", hoyMes, hoyMes)
  );
  const [actividad, setActividad] = useState<string>(() => (ACT[guardado.actividad] ? guardado.actividad : "todas"));
  const [comparar, setComparar] = useState<boolean>(() => guardado.comparar !== false);
  const [modo, setModo] = useState("ingresos");
  const [aMedida, setAMedida] = useState(false);
  const [ver, setVer] = useState(() => localStorage.getItem("gym_ver_metricas") !== "0");

  useEffect(() => {
    api.metricas({ desde: rango.desde, hasta: rango.hasta, actividad }).then(setData).catch((e) => setError(e.message));
  }, [rango.desde, rango.hasta, actividad]);

  // Los filtros se recuerdan entre visitas (mismo criterio que el ojo).
  useEffect(() => {
    try {
      localStorage.setItem(FILTROS_KEY, JSON.stringify({ preset, desde: rango.desde, hasta: rango.hasta, actividad, comparar }));
    } catch {
      /* sin almacenamiento */
    }
  }, [preset, rango.desde, rango.hasta, actividad, comparar]);

  function toggleVer() {
    setVer((v) => {
      localStorage.setItem("gym_ver_metricas", v ? "0" : "1");
      return !v;
    });
  }
  function elegirPreset(k: string) {
    setPreset(k);
    setRango(rangoDePreset(k, hoyMes, data?.rango.dataDesde ?? hoyMes));
    setAMedida(false);
  }
  function cambiarRango(patch: { desde?: string; hasta?: string }) {
    setPreset("");
    setRango((r) => ({ ...r, ...patch }));
  }
  function toggleActividad(k: string) {
    setActividad((a) => (a === k ? "todas" : k));
  }

  const money = (n: number) => (ver ? eur0(n) : "••••• €");

  if (error) return <div className="lienzo"><div className="error-banner" style={{ marginTop: 24 }}>{error}</div></div>;
  if (!data) return <div className="center-box">Cargando métricas…</div>;

  const { serie, serieAnterior, socios, totales, periodoAnterior, proyeccion } = data;
  const actInfo = actividad !== "todas" ? ACT[actividad] : null;

  // Chips de año: uno por año del historial real (de dataDesde a hoy).
  const anios: number[] = [];
  for (let y = Number(data.rango.dataDesde.slice(0, 4)); y <= Number(hoyMes.slice(0, 4)); y++) anios.push(y);

  // ── KPI socios: altas/bajas del periodo
  const totalAltas = serie.reduce((a, x) => a + x.altas, 0);
  const totalBajas = serie.reduce((a, x) => a + x.bajas, 0);
  const neto = totalAltas - totalBajas;
  const netoTexto = (neto > 0 ? "+" : "") + neto;
  const netoColor = neto > 0 ? "var(--verde)" : neto < 0 ? "var(--rojo)" : "var(--tinta-faint)";

  const retMedia = data.retencionMedia;

  // ── Puntos de la gráfica según el modo (con su gemelo de hace 12 meses).
  const valorDe = (fila: MetricaMes) => {
    if (modo === "socios") return fila.socios;
    if (modo === "retencion") return fila.retencion ?? 0;
    return fila.ingresos;
  };
  const puntos: Punto[] = serie.map((s, i) => {
    const ant = serieAnterior[i];
    const gv = comparar && ant ? valorDe(ant) : null;
    return { fila: s, mes: s.mes, valor: valorDe(s), ghostVal: gv != null && gv > 0 ? gv : null };
  });

  const esModoLinea = modo === "retencion";
  const esDinero = modo === "ingresos";
  const valsMedia = esModoLinea ? puntos.map((p) => p.valor).filter((v) => v > 0) : puntos.map((p) => p.valor);
  const mediaModo = valsMedia.length ? valsMedia.reduce((a, v) => a + v, 0) / valsMedia.length : 0;
  const fmt = esDinero ? money : esModoLinea ? (n: number) => Math.round(n) + "%" : (n: number) => `${Math.round(n)}`;
  const fmtEje = esDinero ? eurosCorto : esModoLinea ? (n: number) => Math.round(n) + "%" : (n: number) => `${Math.round(n)}`;
  const mostrarEje = esDinero ? ver : true;

  // ── Reparto por actividad del periodo (siempre las 3; se atenúan al filtrar).
  const sumas: Record<string, number> = {};
  for (const a of data.porActividad) sumas[a.actividad] = a.total;
  const sumasAnt: Record<string, number> = {};
  for (const a of data.porActividadAnterior) sumasAnt[a.actividad] = a.total;
  const totPeriodoTodas = data.porActividad.reduce((s, a) => s + a.total, 0);
  const maxAct = Math.max(1, ...ORDEN_ACT.map((k) => sumas[k] ?? 0));

  const pies: Record<string, string> = {
    ingresos: comparar
      ? "Cobrado por mes y actividad · gris: mismo mes del año anterior · rayado: proyección del mes en curso."
      : "Cobrado por mes y actividad · rayado: proyección del mes en curso.",
    socios: "Socios distintos que pagaron cada mes.",
    retencion: "% de socios que repiten pago al mes siguiente.",
  };

  const maxAB = Math.max(1, ...serie.map((s) => Math.max(s.altas, s.bajas)));

  return (
    <div className="lienzo">
      <div className="page-head">
        <div>
          <div className="eyebrow">Negocio</div>
          <h1>Métricas</h1>
          <div className="sub">
            {mesLargo(data.rango.desde)} — {mesLargo(data.rango.hasta)} · {totales.nPagos.toLocaleString("es-ES")} cobros
            {actInfo ? ` · solo ${actInfo.t}` : ""}
          </div>
        </div>
        <div className="btn-row">
          <button className="ayuda-btn" onClick={toggleVer} title={ver ? "Ocultar importes" : "Mostrar importes"} aria-label={ver ? "Ocultar importes" : "Mostrar importes"}>
            {ver ? OJO_ABIERTO : OJO_CERRADO}
          </button>
          <AyudaMetricas />
        </div>
      </div>

      {/* ── Filtros: periodo (fila 1) + actividad (fila 2) ── */}
      <div className="card met2-filtros">
        <div className="fila">
          <span className="chip-label">Periodo:</span>
          <div className="chips" role="group" aria-label="Periodo">
            <button className={"chip" + (preset === "anio" ? " on" : "")} onClick={() => elegirPreset("anio")}>Este año</button>
            <button className={"chip" + (preset === "12m" ? " on" : "")} onClick={() => elegirPreset("12m")}>12 meses</button>
            <button className={"chip" + (preset === "todo" ? " on" : "")} onClick={() => elegirPreset("todo")}>Todo</button>
          </div>
          <span className="f-sep" aria-hidden="true" />
          <div className="chips" role="group" aria-label="Año completo">
            {anios.map((y) => (
              <button key={y} className={"chip" + (preset === `a${y}` ? " on" : "")} onClick={() => elegirPreset(`a${y}`)}>
                {y}
              </button>
            ))}
          </div>
          <span className="f-sep" aria-hidden="true" />
          <button
            className={"chip" + (aMedida ? " soft-on" : "")}
            style={{ borderStyle: aMedida ? "solid" : "dashed" }}
            onClick={() => setAMedida((v) => !v)}
          >
            A medida…
          </button>
          <div className={"amedida" + (aMedida ? " open" : "")}>
            <input type="month" value={rango.desde} min={data.rango.dataDesde} max={rango.hasta} onChange={(e) => e.target.value && cambiarRango({ desde: e.target.value })} />
            <span className="rc-sep">→</span>
            <input type="month" value={rango.hasta} min={rango.desde} max={hoyMes} onChange={(e) => e.target.value && cambiarRango({ hasta: e.target.value })} />
          </div>
        </div>
        <div className="fila">
          <span className="chip-label">Actividad:</span>
          <div className="chips" role="group" aria-label="Actividad">
            <button className={"chip" + (actividad === "todas" ? " on" : "")} onClick={() => setActividad("todas")}>Todas</button>
            {ORDEN_ACT.map((k) => {
              const a = ACT[k];
              const on = actividad === k;
              return (
                <button
                  key={k}
                  className="chip act"
                  style={on ? { background: a.color, borderColor: a.color, color: "#fff" } : undefined}
                  onClick={() => toggleActividad(k)}
                >
                  <i className="dotc" style={{ background: on ? "#fff" : a.color }} />
                  {a.t}
                </button>
              );
            })}
          </div>
          <span className="met-historial" title="Primer cobro registrado">Historial desde {mesLargo(data.rango.dataDesde)}</span>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="stat-grid met-kpis" style={{ marginTop: 16 }}>
        <div className="stat azul">
          <div className="bar" />
          <div className="label">Ingresos del periodo</div>
          <div className="value"><CifraEuro valor={totales.ingresos} ver={ver} /></div>
          <DeltaAnual actual={totales.ingresos} anterior={periodoAnterior.ingresos} anio={periodoAnterior.desde.slice(0, 4)} />
        </div>
        <div className="stat terracota">
          <div className="bar" />
          <div className="label">
            {MESES_LARGOS[Number(hoyMes.slice(5, 7)) - 1]} <span className="tag-curso">en curso</span>
          </div>
          <div className="value"><CifraEuro valor={proyeccion.cobrado} ver={ver} /></div>
          <div className="nota">día {proyeccion.dia} de {proyeccion.diasMes} · proyección ≈ {money(proyeccion.estimado)}</div>
        </div>
        <div className="stat verde">
          <div className="bar" />
          <div className="label">Socios activos</div>
          <div className="value"><CifraNum valor={socios.activos} /></div>
          <div className="nota">
            <b style={{ color: netoColor }}>{netoTexto}</b> en el periodo · {totalAltas} altas · {totalBajas} bajas
          </div>
        </div>
        <div className="stat oro">
          <div className="bar" />
          <div className="label">Retención media</div>
          <div className="value">{retMedia != null ? <CifraPct valor={retMedia} /> : <span className="cifra">—</span>}</div>
          <div className="nota">de cada 10 que pagan, {retMedia != null ? Math.round(retMedia / 10) : "—"} repiten al mes siguiente</div>
        </div>
      </div>

      {/* ── Gráfica principal ── */}
      <div className="card card-pad" style={{ marginTop: 20 }}>
        <div className="section-title">
          <div className="graf-tabs" role="group" aria-label="Qué mostrar en la gráfica">
            {MODOS.map((m) => (
              <button key={m.k} className={"gt-tab" + (modo === m.k ? " on" : "")} onClick={() => setModo(m.k)}>
                {m.t}
              </button>
            ))}
          </div>
          <span className="leyenda" style={{ alignItems: "center", flexWrap: "wrap" }}>
            {esDinero && actividad === "todas" &&
              ORDEN_ACT.map((k) => (
                <span key={k} className="lg"><i className="pt" style={{ background: ACT[k].color }} /> {ACT[k].t}</span>
              ))}
            {comparar && (
              <span className="lg"><i className="pt" style={{ background: "rgba(20,49,75,0.18)", border: "1px solid rgba(20,49,75,0.35)" }} /> Año anterior</span>
            )}
            {mediaModo > 0 && <span className="lg"><i className="pt media" /> Media {fmt(mediaModo)}</span>}
            <button
              className={"chip" + (comparar ? " soft-on" : "")}
              onClick={() => setComparar((c) => !c)}
              title="Superpone, en gris, el mismo mes del año anterior"
            >
              {comparar ? "✓ vs. año anterior" : "vs. año anterior"}
            </button>
          </span>
        </div>
        <GraficaPrincipal
          puntos={puntos}
          modo={modo}
          actividad={actividad}
          actInfo={actInfo}
          media={mediaModo}
          fmt={fmt}
          fmtEje={fmtEje}
          mostrarEje={mostrarEje}
          money={money}
          hoyMes={hoyMes}
          proyeccion={proyeccion}
        />
        <div className="graf-pie">{pies[modo]}</div>
      </div>

      {/* ── Fila: altas/bajas + reparto por actividad ── */}
      <div className="met2-fila2">
        <div className="card card-pad">
          <div className="section-title">
            Altas y bajas de socios
            <span className="leyenda" style={{ textTransform: "none", letterSpacing: 0 }}>
              <span className="lg"><i className="pt" style={{ background: "var(--verde)" }} /> Altas {totalAltas}</span>
              <span className="lg"><i className="pt" style={{ background: "var(--rojo)" }} /> Bajas {totalBajas}</span>
              <span className="lg" style={{ color: netoColor, fontWeight: 700 }}>Neto {netoTexto}</span>
            </span>
          </div>
          <div className="ab-cols">
            {serie.map((s, i) => {
              const net = s.altas - s.bajas;
              const actual = s.mes === data.mesActual;
              return (
                <div key={s.mes} className="ab-col" title={`${mesLargo(s.mes)}: ${s.altas} altas, ${s.bajas} bajas (neto ${net > 0 ? "+" : ""}${net})`}>
                  <div className="ab-num verde">{s.altas || ""}</div>
                  <div className="ab-arriba">
                    <div className="ab-bar alta" style={{ height: `${(s.altas / maxAB) * 100}%`, animationDelay: `${Math.min(i * 22, 500)}ms` }} />
                  </div>
                  <div className="ab-eje" />
                  <div className="ab-abajo">
                    <div className="ab-bar baja" style={{ height: `${(s.bajas / maxAB) * 100}%`, animationDelay: `${Math.min(i * 22, 500)}ms` }} />
                  </div>
                  <div className="ab-num rojo">{s.bajas || ""}</div>
                  <div className={"ab-mes" + (actual ? " actual" : "")}>{mesCorto(s.mes)}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card card-pad">
          <div className="section-title">Ingresos por actividad</div>
          <div className="bact-lista">
            {ORDEN_ACT.map((k) => {
              const a = ACT[k];
              const v = sumas[k] ?? 0;
              const vAnt = sumasAnt[k] ?? 0;
              let tendencia = "sin datos del año anterior";
              if (vAnt > 0) {
                const p = Math.round(((v - vAnt) / vAnt) * 100);
                tendencia = `${p === 0 ? "→" : p > 0 ? "▲" : "▼"} ${Math.abs(p)}% vs. mismo periodo anterior`;
              }
              return (
                <div
                  key={k}
                  className="bact-fila"
                  style={{ opacity: actividad === "todas" || actividad === k ? 1 : 0.35 }}
                  onClick={() => toggleActividad(k)}
                  title="Filtrar la pantalla por esta actividad"
                >
                  <div className="bact-top">
                    <span className="bact-et"><i className="dotc" style={{ background: a.color }} />{a.t}</span>
                    <span className="bact-val">
                      <b className="cifra">{money(v)}</b>
                      <span className="bact-pct">{totPeriodoTodas > 0 ? Math.round((v / totPeriodoTodas) * 100) : 0}%</span>
                    </span>
                  </div>
                  <div className="bact-track">
                    <div className="bact-fill" style={{ width: `${(v / maxAct) * 100}%`, background: a.color }} />
                  </div>
                  <div className="bact-tend">{tendencia}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Estado de cuotas hoy ── */}
      <div className="card card-pad" style={{ marginTop: 20 }}>
        <div className="section-title">
          Estado de cuotas hoy <span style={{ color: "var(--tinta-faint)", fontWeight: 400 }}>{socios.activos} activos</span>
        </div>
        <SegmentBar
          segmentos={[
            { k: "aldia", t: "Al día", n: socios.aldia, color: "var(--verde)" },
            { k: "pronto", t: "Vencen pronto", n: socios.pronto, color: "var(--ambar)" },
            { k: "atrasado", t: "Atrasados", n: socios.atrasado, color: "var(--rojo)" },
            { k: "pendiente", t: "Sin pagar", n: socios.pendiente, color: "var(--morado)" },
            { k: "sin", t: "Sin cuotas", n: socios.sinCuota, color: "var(--gris)" },
          ]}
        />
        {socios.coberturaManual > 0 && (
          <div className="hint" style={{ marginTop: 10 }}>
            ⚠ {socios.coberturaManual} {socios.coberturaManual === 1 ? "socio está al día" : "socios están al día"} por una
            cobertura apuntada a mano (alta «ya estaba pagado»), sin ningún cobro registrado: ese dinero no aparece en
            Ingresos.
          </div>
        )}
      </div>
    </div>
  );
}

/** Importe con count-up y fundido; respeta el ojo (oculta con "••••• €"). */
function CifraEuro({ valor, ver }: { valor: number; ver: boolean }) {
  const c = useContador(ver ? Math.round(valor) : 0);
  if (!ver) return <span key="oc" className="valor-oculto fade-suave">••••• €</span>;
  return <span key="vi" className="fade-suave cifra">{eur0(c)}</span>;
}
/** Número con count-up (no sensible: no se oculta con el ojo). */
function CifraNum({ valor }: { valor: number }) {
  const c = useContador(valor);
  return <span className="fade-suave cifra">{c}</span>;
}
/** Porcentaje con count-up. */
function CifraPct({ valor }: { valor: number }) {
  const c = useContador(valor);
  return <span className="fade-suave cifra">{c}%</span>;
}

/** Variación del periodo respecto al mismo rango del año anterior. */
function DeltaAnual({ actual, anterior, anio }: { actual: number; anterior: number; anio: string }) {
  if (anterior === 0) return <div className="nota">Sin datos del año pasado</div>;
  const pct = Math.round(((actual - anterior) / Math.abs(anterior)) * 100);
  const sube = pct > 0;
  return (
    <div className={"nota delta " + (pct === 0 ? "neutro" : sube ? "up" : "down")}>
      {pct === 0 ? "→" : sube ? "▲" : "▼"} {Math.abs(pct)}% vs. mismo periodo {anio}
    </div>
  );
}

/**
 * Gráfica por mes con 3 modos: barras apiladas por actividad (ingresos), barras
 * simples (socios) y línea (retención, escala 60–100%). Con barra fantasma del
 * año anterior, proyección rayada del mes en curso, media y tooltip.
 */
function GraficaPrincipal({
  puntos,
  modo,
  actividad,
  actInfo,
  media,
  fmt,
  fmtEje,
  mostrarEje,
  money,
  hoyMes,
  proyeccion,
}: {
  puntos: Punto[];
  modo: string;
  actividad: string;
  actInfo: { t: string; color: string } | null;
  media: number;
  fmt: (n: number) => string;
  fmtEje: (n: number) => string;
  mostrarEje: boolean;
  money: (n: number) => string;
  hoyMes: string;
  proyeccion: { cobrado: number; estimado: number };
}) {
  const [hover, setHover] = useState<number | null>(null);
  const n = puntos.length;
  const esModoLinea = modo === "retencion";
  const esDinero = modo === "ingresos";

  // Máximo del eje: cuenta fantasmas y proyección para que nada se salga.
  let maxBarra = Math.max(1, ...puntos.map((p) => Math.max(p.valor, p.ghostVal ?? 0)));
  if (esDinero && puntos.some((p) => p.mes === hoyMes)) maxBarra = Math.max(maxBarra, proyeccion.estimado);
  // La retención se dibuja de 60 a 100: todo vive ahí arriba.
  const escMin = esModoLinea ? 60 : 0;
  const escMax = esModoLinea ? 100 : maxBarra;
  const escRango = Math.max(1, escMax - escMin);
  const pctDe = (v: number) => Math.max(0, ((v - escMin) / escRango) * 100);

  // Línea de retención (los meses sin dato no puntúan, pero conservan su x).
  const W = 1000, H = 260;
  const xDe = (i: number) => ((i + 0.5) / n) * W;
  const yDe = (v: number) => H - (pctDe(v) / 100) * H;
  const lineaPoints = puntos.map((p, i) => (p.valor > 0 ? `${xDe(i)},${yDe(p.valor)}` : null)).filter(Boolean).join(" ");
  const lineaGhostPoints = puntos.map((p, i) => (p.ghostVal != null ? `${xDe(i)},${yDe(p.ghostVal)}` : null)).filter(Boolean).join(" ");

  // Tooltip
  const h = hover != null ? puntos[hover] : null;
  let tip: { left: string; izq: boolean; mes: string; filas: { dot: string; label: string; val: string; suave?: boolean }[]; sub: string } | null = null;
  if (h) {
    const s = h.fila;
    const filas: { dot: string; label: string; val: string; suave?: boolean }[] = [];
    if (esDinero && actividad === "todas") {
      for (const k of ORDEN_ACT) filas.push({ dot: ACT[k].color, label: ACT[k].t, val: money(s.porActividad[k] ?? 0) });
      filas.push({ dot: "var(--marfil)", label: "Total", val: money(s.ingresos) });
    } else if (esDinero) {
      filas.push({ dot: actInfo!.color, label: actInfo!.t, val: money(h.valor) });
    } else if (modo === "socios") {
      filas.push({ dot: "var(--azul-500)", label: "Socios que pagaron", val: `${h.valor}` });
    } else {
      filas.push({ dot: "var(--azul-500)", label: "Retención", val: h.valor > 0 ? `${h.valor}%` : "—" });
    }
    if (h.ghostVal != null) {
      const d = h.valor - h.ghostVal;
      const pctYoY = Math.round((d / h.ghostVal) * 100);
      filas.push({
        dot: "rgba(251,247,238,0.4)",
        label: "Año anterior",
        val: `${fmt(h.ghostVal)} ${d === 0 ? "→" : d > 0 ? "▲" : "▼"}${esModoLinea ? Math.abs(d) + "pt" : Math.abs(pctYoY) + "%"}`,
        suave: true,
      });
    }
    let sub = `${s.nPagos} cobro${s.nPagos === 1 ? "" : "s"} · ${s.socios} socio${s.socios === 1 ? "" : "s"}`;
    if (h.mes === hoyMes && esDinero) sub = `mes en curso · proyección ≈ ${money(proyeccion.estimado)}`;
    if (esModoLinea) sub = h.valor > 0 ? "de los que pagaron el mes anterior, % que repite" : "sin mes anterior con el que comparar";
    tip = { left: `${((hover! + 0.5) / n) * 100}%`, izq: hover! > n / 2, mes: mesLargo(h.mes), filas, sub };
  }

  return (
    <div className="grafica">
      <div className="graf-plot gp260" onMouseLeave={() => setHover(null)}>
        {[1, 0.75, 0.5, 0.25, 0].map((f) => (
          <div key={f} className="graf-grid" style={{ bottom: `${f * 100}%` }}>
            <span className="graf-yval">{mostrarEje ? fmtEje(escMin + escRango * f) : ""}</span>
          </div>
        ))}
        {media > 0 && (
          <div className="graf-media" style={{ bottom: `${pctDe(media)}%` }}>
            <span className="graf-media-lbl">media</span>
          </div>
        )}

        {!esModoLinea && (
          <div className="graf-cols">
            {puntos.map((p, i) => {
              const s = p.fila;
              const esActual = p.mes === hoyMes;
              const conProy = esDinero && esActual && proyeccion.estimado > p.valor;
              const alturaTotal = conProy ? proyeccion.estimado : p.valor;
              let segs: { color: string; peso: number }[];
              if (esDinero && actividad === "todas") {
                segs = ORDEN_ACT.map((k) => ({ color: ACT[k].color, peso: s.porActividad[k] ?? 0 })).filter((x) => x.peso > 0);
                // Actividades fuera del conjunto conocido (p. ej. "otros"): tramo gris.
                const resto = s.ingresos - segs.reduce((a, x) => a + x.peso, 0);
                if (resto > 0) segs.push({ color: "var(--gris)", peso: resto });
              } else {
                const c = modo === "socios" ? (esActual ? "var(--azul-900)" : "var(--azul-500)") : actInfo ? actInfo.color : "var(--azul-500)";
                segs = p.valor > 0 ? [{ color: c, peso: p.valor }] : [];
              }
              return (
                <div key={p.mes} className={"graf-col" + (hover === i ? " hov" : "") + (esActual ? " actual" : "")} onMouseEnter={() => setHover(i)}>
                  {p.ghostVal != null && (
                    <div className="gb-ghost" title="Mismo mes, año anterior" style={{ height: `${(p.ghostVal / maxBarra) * 100}%` }} />
                  )}
                  <div className="gb-stack" style={{ height: `${(alturaTotal / maxBarra) * 100}%`, animationDelay: `${Math.min(i * 22, 500)}ms` }}>
                    {segs.map((x, ix) => (
                      <div
                        key={ix}
                        className="gb-seg"
                        style={{ background: x.color, flexGrow: x.peso, borderRadius: ix === segs.length - 1 && !conProy ? "3px 3px 0 0" : 0 }}
                      />
                    ))}
                    {conProy && <div className="gb-proy" title="Proyección a fin de mes" style={{ flexGrow: proyeccion.estimado - p.valor }} />}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {esModoLinea && (
          <>
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="gp-svg">
              {lineaGhostPoints && (
                <polyline points={lineaGhostPoints} fill="none" stroke="rgba(20,49,75,0.22)" strokeWidth={2} strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
              )}
              <polyline points={lineaPoints} fill="none" stroke="var(--azul-500)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" strokeDasharray={1600} className="gp-linea" />
            </svg>
            <div className="gp-dots">
              {puntos.map((p, i) => (
                <div key={p.mes} className={"gp-dotcol" + (hover === i ? " hov" : "")} onMouseEnter={() => setHover(i)}>
                  {p.valor > 0 && (
                    <div
                      className="gp-dot"
                      style={{
                        bottom: `${pctDe(p.valor)}%`,
                        width: hover === i ? 13 : 9,
                        height: hover === i ? 13 : 9,
                        background: p.mes === hoyMes ? "var(--azul-900)" : "var(--azul-500)",
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {tip && (
          <div className={"graf-tip" + (tip.izq ? " izq" : "")} style={{ left: tip.left, minWidth: 168 }}>
            <div className="gt-mes">{tip.mes}</div>
            {tip.filas.map((f, i) => (
              <div key={i} className="gt-fila" style={f.suave ? { color: "rgba(251,247,238,0.75)" } : undefined}>
                <i className="pt" style={{ background: f.dot }} /> {f.label} <b className="cifra">{f.val}</b>
              </div>
            ))}
            <div className="gt-sub">{tip.sub}</div>
          </div>
        )}
      </div>
      <div className="graf-xrow">
        {puntos.map((p, i) => (
          <div key={p.mes} className={"graf-xcell" + (p.mes === hoyMes ? " actual" : "")}>
            {mesCorto(p.mes)}
            {(i === 0 || p.mes.slice(5, 7) === "01") && <span className="graf-yr">'{p.mes.slice(2, 4)}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Barra segmentada + leyenda con recuentos. */
function SegmentBar({ segmentos }: { segmentos: { k: string; t: string; n: number; color: string }[] }) {
  const total = segmentos.reduce((s, x) => s + x.n, 0);
  return (
    <div>
      <div className="seg-bar">
        {total === 0 ? (
          <div className="seg empty" />
        ) : (
          segmentos
            .filter((s) => s.n > 0)
            .map((s) => (
              <div key={s.k} className="seg" style={{ width: `${(s.n / total) * 100}%`, background: s.color }} title={`${s.t}: ${s.n}`} />
            ))
        )}
      </div>
      <div className="seg-leyenda">
        {segmentos.map((s) => (
          <span key={s.k} className="sl">
            <i className="pt" style={{ background: s.color }} /> {s.t} <b>{s.n}</b>
          </span>
        ))}
      </div>
    </div>
  );
}
