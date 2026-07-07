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

const INICIAL = 40; // filas que se pintan de entrada
const CHUNK = 24; // filas que se añaden al acercarse al final (scroll infinito)

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

// Orden de la tabla. Por defecto por apellido A→Z (como el archivador físico).
type Orden = "apeAsc" | "apeDesc" | "vence";

const Chevron = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

/** Clave de orden por apellido (cae al nombre si no hay apellidos). */
function claveApellido(s: Socio): string {
  return (s.apellidos || s.nombre || "").trim();
}

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
  const [orden, setOrden] = useState<Orden>("apeAsc");
  const [limite, setLimite] = useState(INICIAL); // scroll infinito: cuántas filas hay pintadas
  const [alto, setAlto] = useState(440); // alto del área con scroll (la página no scrollea)
  const [nuevo, setNuevo] = useState(false);
  const [error, setError] = useState("");
  const [sel, setSel] = useState<Set<number>>(new Set());
  // Animación de salida al filtrar: filas que se van + lista congelada durante el fundido.
  const [saliendo, setSaliendo] = useState<Set<number>>(new Set());
  const [listaCongelada, setListaCongelada] = useState<Socio[] | null>(null);
  const salTimer = useRef<number>(0);
  const visIds = useRef<number[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
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

  // Orden: por apellido (A→Z o Z→A) o por vencimiento (quien vence antes primero).
  const sociosOrdenados =
    orden === "vence"
      ? [...sociosFiltrados].sort((a, b) => {
          if (a.proximaExpiracion === b.proximaExpiracion) return 0;
          if (!a.proximaExpiracion) return 1;
          if (!b.proximaExpiracion) return -1;
          return a.proximaExpiracion < b.proximaExpiracion ? -1 : 1; // ISO asc = vence antes primero
        })
      : (() => {
          const s = [...sociosFiltrados].sort((a, b) => {
            const c = claveApellido(a).localeCompare(claveApellido(b), "es", { sensitivity: "base" });
            return c !== 0 ? c : (a.nombre || "").localeCompare(b.nombre || "", "es", { sensitivity: "base" });
          });
          return orden === "apeDesc" ? s.reverse() : s;
        })();

  // Mientras dura el fundido de salida se muestra la lista congelada (la anterior).
  const listaBase = listaCongelada ?? sociosOrdenados;
  const visibles = listaBase.slice(0, limite);
  visIds.current = visibles.map((s) => s.id);

  // Al cambiar filtros/búsqueda/orden: volver al principio y reiniciar el scroll infinito.
  useEffect(() => {
    setLimite(INICIAL);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [buscar, filtroAct, filtroEstado, filtroCuota, filtroSexo, filtroFecha, orden]);

  // El área con scroll se ajusta a la pantalla (la página en sí no scrollea).
  useEffect(() => {
    function medir() {
      const el = scrollRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      // Reservamos lo que hay DEBAJO del área con scroll: el pie de la tabla y el
      // padding inferior del <main>. Medido, no fijo, para no descuadrar en móvil.
      const pie = el.parentElement?.querySelector<HTMLElement>(".socios-pie");
      const pieH = pie ? pie.getBoundingClientRect().height : 46;
      const main = el.closest<HTMLElement>(".main") ?? document.querySelector<HTMLElement>(".main");
      const mainPad = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0;
      setAlto(Math.max(220, window.innerHeight - top - pieH - mainPad - 8));
    }
    medir();
    const t = setTimeout(medir, 60);
    window.addEventListener("resize", medir);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", medir);
    };
  }, [socios.length]);

  // Scroll infinito: al acercarse al final, pinta el siguiente bloque.
  function alScroll() {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 240) {
      setLimite((l) => (l >= listaBase.length ? l : Math.min(listaBase.length, l + CHUNK)));
    }
  }

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
            <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar por nombre, apellidos o teléfono…" />
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
          <FiltroFecha rango={filtroFecha} onChange={(r) => setFiltroFecha(r)} />
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
            <div className="socios-scroll" ref={scrollRef} style={{ maxHeight: alto }} onScroll={alScroll}>
              <table className="tabla-socios">
                <thead>
                  <tr>
                    <th style={{ width: 30 }}>
                      <input type="checkbox" checked={todosMarcados} onChange={alternarTodos} style={{ width: "auto" }} aria-label="Seleccionar todos" />
                    </th>
                    <th className="th-sort" onClick={() => setOrden((o) => (o === "apeAsc" ? "apeDesc" : "apeAsc"))} title="Ordenar por apellido (A→Z / Z→A)">
                      <span className="th-sort-inner">
                        Socio
                        <span
                          className={"th-chevron" + (orden === "apeAsc" || orden === "apeDesc" ? " on" : "")}
                          style={{ transform: orden === "apeDesc" ? "rotate(180deg)" : undefined }}
                          aria-hidden="true"
                        >
                          <Chevron />
                        </span>
                      </span>
                    </th>
                    <th>Teléfono</th>
                    <th>Actividades</th>
                    <th>Estado cuota</th>
                    <th className="th-sort" onClick={() => setOrden((o) => (o === "vence" ? "apeAsc" : "vence"))} title="Ordenar por quién vence antes">
                      <span className="th-sort-inner">
                        Vence
                        <span className={"th-chevron" + (orden === "vence" ? " on" : "")} aria-hidden="true">
                          <Chevron />
                        </span>
                      </span>
                    </th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((s, idx) => (
                    <tr
                      key={s.id}
                      className={"clickable" + (saliendo.has(s.id) ? " saliendo" : "")}
                      style={{ animationDelay: saliendo.has(s.id) ? "0ms" : `${Math.min(idx * 18, 360)}ms` }}
                      onClick={() => nav(`/socios/${s.id}`)}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={sel.has(s.id)} onChange={() => alternar(s.id)} style={{ width: "auto" }} aria-label={`Seleccionar ${s.nombreCompleto}`} />
                      </td>
                      <td>
                        <span className="nombre">{s.nombreCompleto}</span>
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
            </div>

            <div className="socios-pie">
              <span className="info">
                {listaBase.length} socios{hayFiltro ? " (filtrados)" : ""}
                {visibles.length < listaBase.length ? ` · mostrando ${visibles.length}` : ""}
              </span>
              {sel.size > 0 && <span className="info">{sel.size} seleccionado{sel.size === 1 ? "" : "s"}</span>}
            </div>
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
