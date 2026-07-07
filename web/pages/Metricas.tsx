import { useEffect, useState } from "react";
import { api } from "../api.ts";
import { euros, capitalizar, hoyISO } from "../format.ts";
import { useContador } from "../anim.ts";
import { AyudaMetricas } from "../components/Ayuda.tsx";
import type { Metricas as TMetricas } from "../types.ts";

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
const mesCorto = (m: string) => MESES_ES[Number(m.slice(5, 7)) - 1] ?? m;
const mesLargo = (m: string) => `${mesCorto(m)}. ${m.slice(0, 4)}`;
/** Etiqueta compacta para ejes: 1234 → "1,2k". */
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

const PRESETS = [
  { k: "mes", t: "Este mes" },
  { k: "anio", t: "Este año" },
  { k: "anioPasado", t: "Año pasado" },
  { k: "12m", t: "12 meses" },
  { k: "24m", t: "24 meses" },
  { k: "todo", t: "Todo" },
];
const MODOS = [
  { k: "ingresos", t: "Ingresos" },
  { k: "socios", t: "Socios" },
  { k: "arpu", t: "€ por socio" },
];

function rangoDePreset(k: string, hoyMes: string, dataDesde: string): { desde: string; hasta: string } {
  const y = Number(hoyMes.slice(0, 4));
  switch (k) {
    case "mes":
      return { desde: hoyMes, hasta: hoyMes };
    case "anio":
      return { desde: `${y}-01`, hasta: hoyMes };
    case "anioPasado":
      return { desde: `${y - 1}-01`, hasta: `${y - 1}-12` };
    case "24m":
      return { desde: addMesesStr(hoyMes, -23), hasta: hoyMes };
    case "todo":
      return { desde: dataDesde, hasta: hoyMes };
    case "12m":
    default:
      return { desde: addMesesStr(hoyMes, -11), hasta: hoyMes };
  }
}

export function Metricas() {
  const hoyMes = hoyISO().slice(0, 7);
  const [data, setData] = useState<TMetricas | null>(null);
  const [error, setError] = useState("");
  const [preset, setPreset] = useState("12m");
  const [rango, setRango] = useState(() => rangoDePreset("12m", hoyMes, hoyMes));
  const [modo, setModo] = useState("ingresos");
  const [ver, setVer] = useState(() => localStorage.getItem("gym_ver_metricas") !== "0");

  function toggleVer() {
    setVer((v) => {
      localStorage.setItem("gym_ver_metricas", v ? "0" : "1");
      return !v;
    });
  }
  function elegirPreset(k: string) {
    setPreset(k);
    setRango(rangoDePreset(k, hoyMes, data?.rango.dataDesde ?? hoyMes));
  }
  function cambiarRango(patch: { desde?: string; hasta?: string }) {
    setPreset("");
    setRango((r) => ({ ...r, ...patch }));
  }

  useEffect(() => {
    api.metricas({ desde: rango.desde, hasta: rango.hasta }).then(setData).catch((e) => setError(e.message));
  }, [rango.desde, rango.hasta]);

  const money = (n: number) => (ver ? euros(n) : "••••• €");

  if (error) return <div className="lienzo"><div className="error-banner" style={{ marginTop: 24 }}>{error}</div></div>;
  if (!data) return <div className="center-box">Cargando métricas…</div>;

  const { serie, socios, totales, periodoAnterior } = data;
  const maxAltas = Math.max(1, ...serie.map((s) => s.altas));
  const media = serie.length ? totales.ingresos / serie.length : 0;

  // Serie de la gráfica según el modo elegido.
  const esDinero = modo !== "socios";
  const puntos = serie.map((s) => {
    if (modo === "socios") return { mes: s.mes, valor: s.socios, sub: `${s.nPagos} cobro${s.nPagos === 1 ? "" : "s"}` };
    if (modo === "arpu") return { mes: s.mes, valor: s.socios > 0 ? s.ingresos / s.socios : 0, sub: `${s.socios} socio${s.socios === 1 ? "" : "s"}` };
    return { mes: s.mes, valor: s.ingresos, sub: `${s.nPagos} cobro${s.nPagos === 1 ? "" : "s"}` };
  });
  const mediaModo = puntos.length ? puntos.reduce((a, p) => a + p.valor, 0) / puntos.length : 0;
  const fmt = esDinero ? money : (n: number) => `${Math.round(n)}`;
  const fmtEje = esDinero ? eurosCorto : (n: number) => `${Math.round(n)}`;
  const mostrarEje = esDinero ? ver : true;
  const modoLabel = MODOS.find((m) => m.k === modo)!.t;

  return (
    <div className="lienzo">
      <div className="page-head">
        <div>
          <div className="eyebrow">Negocio</div>
          <h1>Métricas</h1>
          <div className="sub">
            {mesLargo(data.rango.desde)} — {mesLargo(data.rango.hasta)} · {totales.nPagos} cobros
          </div>
        </div>
        <div className="btn-row">
          <button className="ayuda-btn" onClick={toggleVer} title={ver ? "Ocultar importes" : "Mostrar importes"} aria-label={ver ? "Ocultar importes" : "Mostrar importes"}>
            {ver ? OJO_ABIERTO : OJO_CERRADO}
          </button>
          <AyudaMetricas />
        </div>
      </div>

      {/* Filtro de periodo */}
      <div className="card met-filtros">
        <div className="chips" role="group" aria-label="Periodo">
          <span className="chip-label">Periodo:</span>
          {PRESETS.map((p) => (
            <button key={p.k} className={"chip" + (preset === p.k ? " on" : "")} onClick={() => elegirPreset(p.k)}>
              {p.t}
            </button>
          ))}
        </div>
        <span className="filtros-sep" aria-hidden="true" />
        <div className="rango-custom">
          <span className="chip-label">A medida:</span>
          <input type="month" value={rango.desde} min={data.rango.dataDesde} max={rango.hasta} onChange={(e) => e.target.value && cambiarRango({ desde: e.target.value })} />
          <span className="rc-sep">→</span>
          <input type="month" value={rango.hasta} min={rango.desde} max={hoyMes} onChange={(e) => e.target.value && cambiarRango({ hasta: e.target.value })} />
        </div>
        <span className="met-historial" title="Primer cobro registrado">Historial desde {mesLargo(data.rango.dataDesde)}</span>
      </div>

      {/* KPIs del periodo */}
      <div className="stat-grid met-kpis" style={{ marginTop: 16 }}>
        <div className="stat azul">
          <div className="bar" />
          <div className="label">Ingresos del periodo</div>
          <div className="value"><CifraEuro valor={totales.ingresos} ver={ver} /></div>
          <DeltaAnual actual={totales.ingresos} anterior={periodoAnterior.ingresos} />
        </div>
        <div className="stat azul">
          <div className="bar" />
          <div className="label">Media por mes</div>
          <div className="value"><CifraEuro valor={media} ver={ver} /></div>
          <div className="nota">Sobre {serie.length} {serie.length === 1 ? "mes" : "meses"}</div>
        </div>
        <div className="stat oro">
          <div className="bar" />
          <div className="label">Mejor mes de siempre</div>
          <div className="value"><CifraEuro valor={data.mejorMes.ingresos} ver={ver} /></div>
          <div className="nota">{data.mejorMes.ingresos > 0 ? mesLargo(data.mejorMes.mes) : "Sin cobros aún"}</div>
        </div>
        <div className="stat verde">
          <div className="bar" />
          <div className="label">Socios activos</div>
          <div className="value"><CifraNum valor={socios.activos} /></div>
          <div className="nota">{socios.atrasado + socios.pendiente} con cuota pendiente · {socios.bajas} de baja</div>
        </div>
      </div>

      {/* Gráfica por mes, con modos: ingresos / socios / € por socio */}
      <div className="card card-pad" style={{ marginTop: 20 }}>
        <div className="section-title">
          <div className="graf-tabs" role="group" aria-label="Qué mostrar en la gráfica">
            {MODOS.map((m) => (
              <button key={m.k} className={"gt-tab" + (modo === m.k ? " on" : "")} onClick={() => setModo(m.k)}>
                {m.t}
              </button>
            ))}
          </div>
          {mediaModo > 0 && <span className="leyenda"><span className="lg"><i className="pt media" /> Media {fmt(mediaModo)}</span></span>}
        </div>
        <GraficaMeses puntos={puntos} media={mediaModo} fmt={fmt} fmtEje={fmtEje} mostrarEje={mostrarEje} mesActual={data.mesActual} modo={modo} modoLabel={modoLabel} />
        <div className="graf-pie">
          {modo === "ingresos" && "Lo cobrado cada mes (por fecha de cobro)."}
          {modo === "socios" && "Cuántos socios distintos pagaron cada mes."}
          {modo === "arpu" && "Ingreso medio por socio que paga: si se mantiene estable, tus socios pagan y se quedan (retención)."}
        </div>
      </div>

      {/* Ingresos por actividad */}
      <div className="card card-pad" style={{ marginTop: 20 }}>
        <div className="section-title">Ingresos por actividad</div>
        <BarrasH
          filas={data.porActividad.map((a) => ({ etiqueta: capitalizar(a.actividad), valor: a.total }))}
          total={data.porActividad.reduce((s, a) => s + a.total, 0)}
          money={money}
          color="var(--azul-500)"
        />
      </div>

      {/* Evolución de socios */}
      <div className="card card-pad" style={{ marginTop: 20 }}>
        <div className="section-title">Evolución de socios</div>
        <div className="met-cols met-cols-b">
          <div>
            <div className="mini-titulo">Altas por mes</div>
            <div className="graf-altas">
              {serie.map((s, i) => (
                <div key={s.mes} className="ga-col" title={`${mesLargo(s.mes)}: ${s.altas} alta${s.altas === 1 ? "" : "s"}`}>
                  <div className="ga-barras">
                    <div className="ga-bar" style={{ height: `${(s.altas / maxAltas) * 100}%`, animationDelay: `${Math.min(i * 22, 500)}ms` }} />
                  </div>
                  <div className="ga-num">{s.altas || ""}</div>
                  <div className="graf-xlabel">{mesCorto(s.mes)}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="mini-titulo">Estado de cuotas hoy ({socios.activos} activos)</div>
            <SegmentBar
              segmentos={[
                { k: "aldia", t: "Al día", n: socios.aldia, color: "var(--verde)" },
                { k: "pronto", t: "Vencen pronto", n: socios.pronto, color: "var(--ambar)" },
                { k: "atrasado", t: "Atrasados", n: socios.atrasado, color: "var(--rojo)" },
                { k: "pendiente", t: "Sin pagar", n: socios.pendiente, color: "var(--morado)" },
                { k: "sin", t: "Sin cuotas", n: socios.sinCuota, color: "var(--gris)" },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Importe con count-up y fundido; respeta el ojo (oculta con "••••• €"). */
function CifraEuro({ valor, ver }: { valor: number; ver: boolean }) {
  const objetivo = Math.round(valor);
  const c = useContador(ver ? objetivo : 0);
  if (!ver) return <span key="oc" className="valor-oculto fade-suave">••••• €</span>;
  return <span key="vi" className="fade-suave cifra">{c === objetivo ? euros(valor) : euros(c)}</span>;
}
/** Número con count-up (no sensible: no se oculta con el ojo). */
function CifraNum({ valor }: { valor: number }) {
  const c = useContador(valor);
  return <span className="fade-suave cifra">{c}</span>;
}

/** Variación del periodo respecto al mismo rango del año anterior. */
function DeltaAnual({ actual, anterior }: { actual: number; anterior: number }) {
  if (anterior === 0) return <div className="nota">Sin datos del año pasado</div>;
  const pct = Math.round(((actual - anterior) / Math.abs(anterior)) * 100);
  const sube = pct > 0;
  return (
    <div className={"nota delta " + (pct === 0 ? "neutro" : sube ? "up" : "down")}>
      {pct === 0 ? "→" : sube ? "▲" : "▼"} {Math.abs(pct)}% vs. año pasado
    </div>
  );
}

/** Gráfica de barras por mes (genérica: ingresos, socios o €/socio) con media y tooltip. */
function GraficaMeses({
  puntos,
  media,
  fmt,
  fmtEje,
  mostrarEje,
  mesActual,
  modo,
  modoLabel,
}: {
  puntos: { mes: string; valor: number; sub: string }[];
  media: number;
  fmt: (n: number) => string;
  fmtEje: (n: number) => string;
  mostrarEje: boolean;
  mesActual: string;
  modo: string;
  modoLabel: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const n = puntos.length;
  const maxBarra = Math.max(1, ...puntos.map((p) => p.valor));
  const lineas = [1, 0.75, 0.5, 0.25, 0];
  const h = hover != null ? puntos[hover] : null;
  return (
    <div className="grafica">
      <div className="graf-plot" onMouseLeave={() => setHover(null)}>
        {lineas.map((f) => (
          <div key={f} className="graf-grid" style={{ bottom: `${f * 100}%` }}>
            <span className="graf-yval">{mostrarEje ? fmtEje(maxBarra * f) : ""}</span>
          </div>
        ))}
        {media > 0 && (
          <div className="graf-media" style={{ bottom: `${(media / maxBarra) * 100}%` }}>
            <span className="graf-media-lbl">media</span>
          </div>
        )}
        <div className="graf-cols">
          {puntos.map((p, i) => (
            <div
              key={modo + p.mes}
              className={"graf-col" + (hover === i ? " hov" : "") + (p.mes === mesActual ? " actual" : "")}
              onMouseEnter={() => setHover(i)}
            >
              <div className="gb ingresos" style={{ height: `${(p.valor / maxBarra) * 100}%`, animationDelay: `${Math.min(i * 22, 500)}ms` }} />
            </div>
          ))}
        </div>
        {h && (
          <div className={"graf-tip" + (hover! > n / 2 ? " izq" : "")} style={{ left: `${((hover! + 0.5) / n) * 100}%` }}>
            <div className="gt-mes">{mesLargo(h.mes)}</div>
            <div className="gt-fila"><i className="pt ing" /> {modoLabel} <b className="cifra">{fmt(h.valor)}</b></div>
            <div className="gt-sub">{h.sub}</div>
          </div>
        )}
      </div>
      <div className="graf-xrow">
        {puntos.map((p, i) => (
          <div key={p.mes} className={"graf-xcell" + (p.mes === mesActual ? " actual" : "")}>
            {mesCorto(p.mes)}
            {(i === 0 || p.mes.slice(5, 7) === "01") && <span className="graf-yr">'{p.mes.slice(2, 4)}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Barras horizontales con etiqueta, importe y % del total. */
function BarrasH({
  filas,
  total,
  money,
  color,
}: {
  filas: { etiqueta: string; valor: number }[];
  total: number;
  money: (n: number) => string;
  color: string;
}) {
  if (filas.length === 0) return <div className="empty-col">Sin datos en este periodo.</div>;
  const max = Math.max(1, ...filas.map((f) => f.valor));
  return (
    <div className="barras-h">
      {filas.map((f) => (
        <div key={f.etiqueta} className="bh-fila">
          <div className="bh-top">
            <span className="bh-et">{f.etiqueta}</span>
            <span className="bh-val">
              <b className="cifra">{money(f.valor)}</b>
              <span className="bh-pct">{total > 0 ? Math.round((f.valor / total) * 100) : 0}%</span>
            </span>
          </div>
          <div className="bh-track">
            <div className="bh-fill" style={{ width: `${(f.valor / max) * 100}%`, background: color }} />
          </div>
        </div>
      ))}
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
