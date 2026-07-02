import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ACTIVIDADES } from "../api.ts";
import { capitalizar, descargar, fecha } from "../format.ts";
import { EstadoBadge } from "../components/Badges.tsx";
import { SocioFormModal } from "../components/SocioFormModal.tsx";
import { AyudaSocios } from "../components/Ayuda.tsx";
import { FiltroFecha } from "../components/FiltroFecha.tsx";
import { filtrarSocios, hayFiltrosActivos, type FiltrosSocios, type RangoFecha } from "../filtros.ts";
import type { Socio } from "../types.ts";

const MIN_FILAS = 6;

const OPC_ESTADO = [
  { k: "activo", t: "Activos" },
  { k: "baja", t: "Bajas" },
];
const OPC_CUOTA = [
  { k: "pendiente", t: "Pendientes" },
  { k: "pronto", t: "Vencen pronto" },
  { k: "aldia", t: "Al día" },
  { k: "sin", t: "Sin cuotas" },
];
const OPC_SEXO = [
  { k: "hombre", t: "Hombre" },
  { k: "mujer", t: "Mujer" },
];

function GrupoChips({ label, opciones, valor, onToggle }: { label: string; opciones: { k: string; t: string }[]; valor: Set<string>; onToggle: (k: string) => void }) {
  return (
    <div className="chips">
      <span className="chip-label">{label}:</span>
      {opciones.map((o) => (
        <button key={o.k} className={"chip" + (valor.has(o.k) ? " on" : "")} onClick={() => onToggle(o.k)}>
          {o.t}
        </button>
      ))}
    </div>
  );
}

type TipoFiltro = "act" | "est" | "cuo" | "sex";

export function Socios() {
  const [params] = useSearchParams();
  const desdeUrl = (k: string) => new Set((params.get(k) || "").split(",").filter(Boolean));

  const [socios, setSocios] = useState<Socio[]>([]);
  const [buscar, setBuscar] = useState("");
  const [filtroAct, setFiltroAct] = useState<Set<string>>(() => desdeUrl("actividad"));
  const [filtroEstado, setFiltroEstado] = useState<Set<string>>(() => desdeUrl("estado"));
  const [filtroCuota, setFiltroCuota] = useState<Set<string>>(() => desdeUrl("cuota"));
  const [filtroSexo, setFiltroSexo] = useState<Set<string>>(() => desdeUrl("sexo"));
  const [filtroFecha, setFiltroFecha] = useState<RangoFecha>({ desde: null, hasta: null });
  const [ordenVence, setOrdenVence] = useState(false); // false = orden natural; true = quien vence antes primero
  const [pagina, setPagina] = useState(1);
  const [filasPorPagina, setFilasPorPagina] = useState(12);
  const [nuevo, setNuevo] = useState(false);
  const [error, setError] = useState("");
  const [sel, setSel] = useState<Set<number>>(new Set());
  // Animación de salida al filtrar: filas que se van + lista congelada durante el fundido.
  const [saliendo, setSaliendo] = useState<Set<number>>(new Set());
  const [listaCongelada, setListaCongelada] = useState<Socio[] | null>(null);
  const salTimer = useRef<number>(0);
  const visIds = useRef<number[]>([]);
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const nav = useNavigate();

  function recargar(q = buscar) {
    api
      .socios(q)
      .then((filas) => {
        setSocios(filas);
        setSel((prev) => new Set(filas.filter((s) => prev.has(s.id)).map((s) => s.id)));
      })
      .catch((e) => setError(e.message));
  }
  useEffect(() => {
    const t = setTimeout(() => recargar(buscar), 200);
    return () => clearTimeout(t);
  }, [buscar]);
  useEffect(() => () => window.clearTimeout(salTimer.current), []);

  // Filtrado cliente (lógica pura y testeada en web/filtros.pruebas.ts).
  const filtros: FiltrosSocios = { actividades: [...filtroAct], estado: [...filtroEstado], cuota: [...filtroCuota], sexo: [...filtroSexo], fecha: filtroFecha };
  const sociosFiltrados = filtrarSocios(socios, filtros);
  const hayFiltro = buscar.trim() !== "" || hayFiltrosActivos(filtros);

  // Calcula cuántas filas caben en la pantalla y pagina el resto (sin scroll de página).
  useEffect(() => {
    function medir() {
      const tb = tbodyRef.current;
      if (!tb || tb.rows.length === 0) return;
      const altoFila = tb.rows[0].getBoundingClientRect().height || 46;
      const arriba = tb.getBoundingClientRect().top;
      const reserva = 130; // paginación + respiración + padding inferior del contenido
      const caben = Math.max(MIN_FILAS, Math.floor((window.innerHeight - arriba - reserva) / altoFila));
      setFilasPorPagina((prev) => (prev === caben ? prev : caben));
    }
    medir();
    const t = setTimeout(medir, 60);
    window.addEventListener("resize", medir);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", medir);
    };
  }, [socios.length, sociosFiltrados.length]);

  // Orden opcional por vencimiento (los que no tienen cuota con fecha van al final).
  const sociosOrdenados = ordenVence
    ? [...sociosFiltrados].sort((a, b) => {
        if (a.proximaExpiracion === b.proximaExpiracion) return 0;
        if (!a.proximaExpiracion) return 1;
        if (!b.proximaExpiracion) return -1;
        return a.proximaExpiracion < b.proximaExpiracion ? -1 : 1; // ISO asc = vence antes primero
      })
    : sociosFiltrados;

  // Mientras dura el fundido de salida se muestra la lista congelada (la anterior).
  const listaBase = listaCongelada ?? sociosOrdenados;
  const totalPaginas = Math.max(1, Math.ceil(listaBase.length / filasPorPagina));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = listaBase.slice((paginaActual - 1) * filasPorPagina, paginaActual * filasPorPagina);
  visIds.current = visibles.map((s) => s.id);

  // El export se adapta: marcados → esos; si no, lo filtrado; sin filtro → todos.
  const idsExport = sel.size ? [...sel] : hayFiltro ? sociosFiltrados.map((s) => s.id) : undefined;
  const nExport = sel.size || sociosFiltrados.length;

  /** Cambia un filtro de chips. Si hay filas visibles que van a desaparecer,
   *  primero se funden (240 ms) y después se aplica la lista nueva. */
  function alternaEn(tipo: TipoFiltro, k: string) {
    const actuales: Record<TipoFiltro, [Set<string>, Dispatch<SetStateAction<Set<string>>>]> = {
      act: [filtroAct, setFiltroAct],
      est: [filtroEstado, setFiltroEstado],
      cuo: [filtroCuota, setFiltroCuota],
      sex: [filtroSexo, setFiltroSexo],
    };
    const [actual, setter] = actuales[tipo];
    const n = new Set(actual);
    if (n.has(k)) n.delete(k);
    else n.add(k);

    const futuros: FiltrosSocios = {
      actividades: [...(tipo === "act" ? n : filtroAct)],
      estado: [...(tipo === "est" ? n : filtroEstado)],
      cuota: [...(tipo === "cuo" ? n : filtroCuota)],
      sexo: [...(tipo === "sex" ? n : filtroSexo)],
      fecha: filtroFecha,
    };
    const idsFuturos = new Set(filtrarSocios(socios, futuros).map((s) => s.id));
    const sal = new Set(visIds.current.filter((id) => !idsFuturos.has(id)));

    window.clearTimeout(salTimer.current);
    if (sal.size === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPagina(1);
      setter(n);
      setListaCongelada(null);
      setSaliendo(new Set());
      return;
    }
    setSaliendo(sal);
    setListaCongelada(sociosOrdenados); // el chip cambia ya; la tabla espera al fundido
    setter(n);
    salTimer.current = window.setTimeout(() => {
      setListaCongelada(null);
      setSaliendo(new Set());
      setPagina(1);
    }, 240);
  }
  function alternar(id: number) {
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function alternarTodos() {
    const ids = sociosFiltrados.map((s) => s.id);
    setSel((prev) => {
      const todos = ids.length > 0 && ids.every((id) => prev.has(id));
      const n = new Set(prev);
      ids.forEach((id) => (todos ? n.delete(id) : n.add(id)));
      return n;
    });
  }
  function limpiar() {
    window.clearTimeout(salTimer.current);
    setListaCongelada(null);
    setSaliendo(new Set());
    setBuscar("");
    setFiltroAct(new Set());
    setFiltroEstado(new Set());
    setFiltroCuota(new Set());
    setFiltroSexo(new Set());
    setFiltroFecha({ desde: null, hasta: null });
    setPagina(1);
  }

  const todosMarcados = sociosFiltrados.length > 0 && sociosFiltrados.every((s) => sel.has(s.id));

  return (
    <div className="lienzo">
      <div className="page-head">
        <div>
          <div className="eyebrow">Miembros</div>
          <h1>Socios</h1>
          <div className="sub">{socios.length} socios</div>
        </div>
        <div className="btn-row">
          <button className="btn" onClick={() => descargar(api.exportSociosUrl(idsExport))}>
            Exportar Excel {idsExport === undefined ? "(todos)" : `(${nExport})`}
          </button>
          <button className="btn primary" onClick={() => setNuevo(true)}>
            + Nuevo socio
          </button>
          <AyudaSocios />
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card" style={{ overflow: "hidden" }}>
        {/* Banda única: búsqueda + filtros + limpiar (con hueco reservado, no mueve nada) */}
        <div className="filtros-banda">
          <div className="search">
            <span className="ico">⌕</span>
            <input value={buscar} onChange={(e) => { setBuscar(e.target.value); setPagina(1); }} placeholder="Buscar por nombre o teléfono…" />
          </div>
          <span className="filtros-sep" aria-hidden="true" />
          <GrupoChips label="Actividad" opciones={ACTIVIDADES.map((a) => ({ k: a, t: capitalizar(a) }))} valor={filtroAct} onToggle={(k) => alternaEn("act", k)} />
          <span className="filtros-sep" aria-hidden="true" />
          <GrupoChips label="Estado" opciones={OPC_ESTADO} valor={filtroEstado} onToggle={(k) => alternaEn("est", k)} />
          <span className="filtros-sep" aria-hidden="true" />
          <GrupoChips label="Cuota" opciones={OPC_CUOTA} valor={filtroCuota} onToggle={(k) => alternaEn("cuo", k)} />
          <span className="filtros-sep" aria-hidden="true" />
          <GrupoChips label="Sexo" opciones={OPC_SEXO} valor={filtroSexo} onToggle={(k) => alternaEn("sex", k)} />
          <span className="filtros-sep" aria-hidden="true" />
          <FiltroFecha rango={filtroFecha} onChange={(r) => { setPagina(1); setFiltroFecha(r); }} />
          <button className={"btn ghost sm limpiar-reservado" + (hayFiltro ? " on" : "")} onClick={limpiar} tabIndex={hayFiltro ? 0 : -1}>
            Limpiar filtros
          </button>
        </div>

        {listaBase.length === 0 ? (
          <div className="center-box">
            {hayFiltro ? "Ningún socio coincide con el filtro." : "Aún no hay socios. Crea el primero con “Nuevo socio”."}
          </div>
        ) : (
          <>
            <table className="tabla-socios">
              <thead>
                <tr>
                  <th style={{ width: 30 }}>
                    <input type="checkbox" checked={todosMarcados} onChange={alternarTodos} style={{ width: "auto" }} aria-label="Seleccionar todos" />
                  </th>
                  <th>Nombre</th>
                  <th>Teléfono</th>
                  <th>Actividades</th>
                  <th>Estado cuota</th>
                  <th className="th-sort" onClick={() => { setOrdenVence((v) => !v); setPagina(1); }} title="Ordenar por quién vence antes">
                    <span className="th-sort-inner">
                      Vence
                      <span className={"th-chevron" + (ordenVence ? " on" : "")} aria-hidden="true">
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </span>
                    </span>
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody ref={tbodyRef}>
                {visibles.map((s, idx) => (
                  <tr
                    key={s.id}
                    className={"clickable" + (saliendo.has(s.id) ? " saliendo" : "")}
                    style={{ animationDelay: saliendo.has(s.id) ? "0ms" : `${Math.min(idx * 22, 400)}ms` }}
                    onClick={() => nav(`/socios/${s.id}`)}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={sel.has(s.id)} onChange={() => alternar(s.id)} style={{ width: "auto" }} aria-label={`Seleccionar ${s.nombre}`} />
                    </td>
                    <td>
                      <span className="nombre">{s.nombre}</span>
                      {s.estado === "baja" && <span className="badge gris" style={{ marginLeft: 8 }}>Baja</span>}
                    </td>
                    <td className="muted">{s.telefono || "—"}</td>
                    <td>
                      <div className="tag-list">
                        {s.suscripciones.filter((x) => x.activa).map((x) => (
                          <span key={x.id} className="pill-act">
                            {capitalizar(x.actividad)}
                          </span>
                        ))}
                        {s.suscripciones.filter((x) => x.activa).length === 0 && <span className="muted">—</span>}
                      </div>
                    </td>
                    <td>
                      <EstadoBadge estado={s.estadoResumen} />
                    </td>
                    <td className="td-vence">{fecha(s.proximaExpiracion)}</td>
                    <td style={{ textAlign: "right", color: "var(--text-faint)" }}>›</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPaginas > 1 && (
              <div className="paginacion">
                <span className="info">
                  {listaBase.length} socios{hayFiltro ? " (filtrados)" : ""}
                </span>
                <div className="controles">
                  <button className="btn sm" disabled={paginaActual <= 1} onClick={() => setPagina((p) => Math.max(1, p - 1))}>
                    ‹ Anterior
                  </button>
                  <span className="pag-num">{paginaActual} / {totalPaginas}</span>
                  <button className="btn sm" disabled={paginaActual >= totalPaginas} onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}>
                    Siguiente ›
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {nuevo && (
        <SocioFormModal
          onCerrar={() => setNuevo(false)}
          onHecho={(s) => {
            setNuevo(false);
            nav(`/socios/${s.id}`);
          }}
        />
      )}
    </div>
  );
}
