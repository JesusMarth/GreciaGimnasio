import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ACTIVIDADES } from "../api.ts";
import { capitalizar, descargar, euros, fecha } from "../format.ts";
import { EstadoBadge } from "../components/Badges.tsx";
import { Modal } from "../components/Modal.tsx";
import { SocioFormModal } from "../components/SocioFormModal.tsx";
import { AyudaSocios } from "../components/Ayuda.tsx";
import { FiltroFecha } from "../components/FiltroFecha.tsx";
import { avisosDe, claveImporte, filtrarSocios, hayFiltrosActivos, importesUltimoPago, type FiltrosSocios, type RangoFecha } from "../filtros.ts";
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
  { k: "sin", t: "Sin asignar" }, // posible olvido al dar el alta
];
// "Con aviso" = socios con la exclamación ámbar (avisosDe en web/filtros.ts).

// Cómo estaba la pantalla (filtros, orden, scroll) — para restaurarla al volver de
// una ficha y no perder el sitio en la tabla. Vive en sessionStorage: se olvida al
// cerrar la app, pero sobrevive a navegar entre pantallas.
const KEY_UI = "gym_socios_ui";
function leerUI(): any {
  try {
    return JSON.parse(sessionStorage.getItem(KEY_UI) || "null");
  } catch {
    return null;
  }
}

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

type TipoFiltro = "act" | "est" | "cuo" | "sex" | "avi" | "pag";

export function Socios() {
  const [params] = useSearchParams();
  const desdeUrl = (k: string) => new Set((params.get(k) || "").split(",").filter(Boolean));
  // Si la URL trae filtros (enlaces desde el Panel o Métricas), mandan ellos; si no,
  // se restaura cómo quedó la pantalla la última vez (al volver de una ficha).
  const urlConFiltros = ["actividad", "estado", "cuota", "sexo", "avisos", "pago"].some((k) => params.get(k));
  const [ui] = useState<any>(() => (urlConFiltros ? null : leerUI()));

  const [socios, setSocios] = useState<Socio[]>([]);
  const [buscar, setBuscar] = useState<string>(ui?.buscar ?? "");
  const [filtroAct, setFiltroAct] = useState<Set<string>>(() => (ui ? new Set<string>(ui.act ?? []) : desdeUrl("actividad")));
  const [filtroEstado, setFiltroEstado] = useState<Set<string>>(() => (ui ? new Set<string>(ui.est ?? []) : desdeUrl("estado")));
  const [filtroCuota, setFiltroCuota] = useState<Set<string>>(() => (ui ? new Set<string>(ui.cuo ?? []) : desdeUrl("cuota")));
  const [filtroSexo, setFiltroSexo] = useState<Set<string>>(() => (ui ? new Set<string>(ui.sex ?? []) : desdeUrl("sexo")));
  const [filtroAvisos, setFiltroAvisos] = useState<Set<string>>(() => (ui ? new Set<string>(ui.avi ?? []) : desdeUrl("avisos")));
  const [filtroPago, setFiltroPago] = useState<Set<string>>(() => (ui ? new Set<string>(ui.pag ?? []) : desdeUrl("pago")));
  const [filtroFecha, setFiltroFecha] = useState<RangoFecha>(ui?.fecha ?? { desde: null, hasta: null });
  const [orden, setOrden] = useState<Orden>(ui?.orden ?? "apeAsc");
  const [limite, setLimite] = useState<number>(ui?.limite ?? INICIAL); // scroll infinito: cuántas filas hay pintadas
  const [modalFiltros, setModalFiltros] = useState(false);
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
  // Última posición de scroll conocida (se guarda al salir para restaurarla al volver).
  const ultimoScroll = useRef<number>(ui?.scrollTop ?? 0);
  const snap = useRef<any>(null);

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
  const filtros: FiltrosSocios = { actividades: [...filtroAct], estado: [...filtroEstado], cuota: [...filtroCuota], sexo: [...filtroSexo], avisos: [...filtroAvisos], pagos: [...filtroPago], fecha: filtroFecha };
  const sociosFiltrados = filtrarSocios(socios, filtros);
  const hayFiltro = buscar.trim() !== "" || hayFiltrosActivos(filtros);
  // El aviso ("!") tiene su propio botón fuera de la ventana, no cuenta en el nº de la ventana.
  const nFiltros = filtroAct.size + filtroEstado.size + filtroCuota.size + filtroSexo.size + filtroPago.size + (filtroFecha.desde || filtroFecha.hasta ? 1 : 0);
  // Importes de último pago EN USO (para el filtro "Último pago": solo lo que existe).
  const importesEnUso = importesUltimoPago(socios);

  // Foto del estado de la pantalla, siempre al día; al desmontar se guarda para
  // que "Volver" desde una ficha te deje exactamente donde estabas.
  snap.current = { buscar, act: [...filtroAct], est: [...filtroEstado], cuo: [...filtroCuota], sex: [...filtroSexo], avi: [...filtroAvisos], pag: [...filtroPago], fecha: filtroFecha, orden, limite };
  useEffect(
    () => () => {
      try {
        sessionStorage.setItem(KEY_UI, JSON.stringify({ ...snap.current, scrollTop: ultimoScroll.current }));
      } catch {
        /* sin almacenamiento */
      }
    },
    []
  );

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

  // Al cambiar filtros/búsqueda/orden: volver al principio y reiniciar el scroll
  // infinito. En el primer render NO (podríamos estar restaurando el estado guardado).
  const montado = useRef(false);
  useEffect(() => {
    if (!montado.current) {
      montado.current = true;
      return;
    }
    setLimite(INICIAL);
    ultimoScroll.current = 0;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [buscar, filtroAct, filtroEstado, filtroCuota, filtroSexo, filtroAvisos, filtroPago, filtroFecha, orden]);

  // Al volver de una ficha: recolocar el scroll donde estaba (cuando ya hay filas).
  useEffect(() => {
    if (!socios.length || !ultimoScroll.current) return;
    const t = setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = ultimoScroll.current;
    }, 80);
    return () => clearTimeout(t);
  }, [socios.length]);

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
    ultimoScroll.current = el.scrollTop;
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
      avi: [filtroAvisos, setFiltroAvisos],
      pag: [filtroPago, setFiltroPago],
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
      avisos: [...(tipo === "avi" ? n : filtroAvisos)],
      pagos: [...(tipo === "pag" ? n : filtroPago)],
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
    setFiltroAvisos(new Set());
    setFiltroPago(new Set());
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
        {/* Banda: búsqueda + botón Filtros (abre la ventana) + limpiar */}
        <div className="filtros-banda">
          <div className="search">
            <span className="ico">⌕</span>
            <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar por nombre, apellidos o teléfono…" />
          </div>
          <button className={"btn sm filtros-toggle" + (nFiltros > 0 ? " activos" : "")} onClick={() => setModalFiltros(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 5h18l-7 8v5.5l-4 2V13L3 5Z" />
            </svg>
            Filtros
            {nFiltros > 0 && <span className="filtros-num">{nFiltros}</span>}
          </button>
          <button
            className={"btn sm aviso-toggle" + (filtroAvisos.has("con") ? " on" : "")}
            onClick={() => alternaEn("avi", "con")}
            title="Mostrar solo socios con aviso"
            aria-label="Mostrar solo socios con aviso"
            aria-pressed={filtroAvisos.has("con")}
          >
            <span className="aviso-flag chica" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round">
                <line x1="12" y1="6" x2="12" y2="13" />
                <line x1="12" y1="18" x2="12" y2="18.01" />
              </svg>
            </span>
          </button>
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
                    <th style={{ width: 24 }} aria-label="Avisos"></th>
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
                    <th>Último pago</th>
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
                      <td className="td-aviso">
                        {avisosDe(s).length > 0 && (
                          <span className="aviso-flag" title={avisosDe(s).join("\n")} aria-label="Este socio tiene un aviso">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" aria-hidden="true">
                              <line x1="12" y1="6" x2="12" y2="13" />
                              <line x1="12" y1="18" x2="12" y2="18.01" />
                            </svg>
                          </span>
                        )}
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
                      <td className="td-pago" title={s.ultimoPago ? `Cobrado el ${fecha(s.ultimoPago.fecha)}` : "Sin cobros registrados"}>
                        {s.ultimoPago ? euros(s.ultimoPago.total) : <span className="muted">—</span>}
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

      {modalFiltros && (
        <Modal
          titulo="Filtrar socios"
          onCerrar={() => setModalFiltros(false)}
          pie={
            <>
              <button className="btn ghost" onClick={limpiar} disabled={!hayFiltro}>
                Limpiar todo
              </button>
              <button className="btn primary" onClick={() => setModalFiltros(false)}>
                Ver {sociosFiltrados.length} socio{sociosFiltrados.length === 1 ? "" : "s"}
              </button>
            </>
          }
        >
          <div className="modal-body">
            <div className="fm-grupo">
              <span className="chip-label">Actividad</span>
              <div className="chips">
                {ACTIVIDADES.map((a) => (
                  <button key={a} className={"chip" + (filtroAct.has(a) ? " on" : "")} onClick={() => alternaEn("act", a)}>
                    {capitalizar(a)}
                  </button>
                ))}
              </div>
            </div>
            <div className="fm-grupo">
              <span className="chip-label">Estado del socio</span>
              <div className="chips">
                {OPC_ESTADO.map((o) => (
                  <button key={o.k} className={"chip" + (filtroEstado.has(o.k) ? " on" : "")} onClick={() => alternaEn("est", o.k)}>
                    {o.t}
                  </button>
                ))}
              </div>
            </div>
            <div className="fm-grupo">
              <span className="chip-label">Estado de cuota</span>
              <div className="chips">
                {OPC_CUOTA.map((o) => (
                  <button key={o.k} className={"chip" + (filtroCuota.has(o.k) ? " on" : "")} onClick={() => alternaEn("cuo", o.k)}>
                    {o.t}
                  </button>
                ))}
              </div>
            </div>
            <div className="fm-grupo">
              <span className="chip-label">Último pago</span>
              {importesEnUso.length === 0 && filtroPago.size === 0 ? (
                <span className="muted">Aún no hay cobros registrados.</span>
              ) : (
                <div className="chips">
                  {/* Importes en uso + los ya marcados (por si un filtro guardado apunta a un importe que ya nadie usa: sin su chip no se podría quitar). */}
                  {[...new Set([...importesEnUso.map(claveImporte), ...filtroPago])]
                    .sort((a, b) => Number(a) - Number(b))
                    .map((k) => (
                      <button key={k} className={"chip" + (filtroPago.has(k) ? " on" : "")} onClick={() => alternaEn("pag", k)}>
                        {euros(Number(k))}
                      </button>
                    ))}
                </div>
              )}
            </div>
            <div className="fm-grupo">
              <span className="chip-label">Sexo</span>
              <div className="chips">
                {OPC_SEXO.map((o) => (
                  <button key={o.k} className={"chip" + (filtroSexo.has(o.k) ? " on" : "")} onClick={() => alternaEn("sex", o.k)}>
                    {o.t}
                  </button>
                ))}
              </div>
            </div>
            <div className="fm-grupo">
              <span className="chip-label">Fecha de alta</span>
              <div className="chips">
                <FiltroFecha rango={filtroFecha} onChange={(r) => setFiltroFecha(r)} />
              </div>
            </div>
          </div>
        </Modal>
      )}

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
