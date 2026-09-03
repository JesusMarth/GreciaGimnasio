import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";

export interface OpcionDesplegable {
  value: string;
  label: string;
  /** Texto secundario a la derecha (p. ej. "60 €"). */
  extra?: string;
  disabled?: boolean;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  opciones: OpcionDesplegable[];
  disabled?: boolean;
  /** Texto cuando el valor no está entre las opciones. */
  placeholder?: string;
  title?: string;
  /** Alto máximo de la lista en px (por defecto 280). */
  altoMax?: number;
  id?: string;
}

// Desplegable propio en sustitución del <select> nativo, que no admite diseño ni
// animación al abrirse. La lista se pinta en un portal (position: fixed) para que
// no la recorte el overflow de los modales, con la MISMA anchura que su caja (un
// nombre largo se corta con «…», nunca ensancha nada). Teclado: flechas, Inicio/Fin,
// Enter/Espacio, Escape, y escribir una letra salta a la opción que empieza así.
const DURACION = 160;

export function Desplegable({ value, onChange, opciones, disabled, placeholder = "—", title, altoMax = 280, id }: Props) {
  const raiz = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; arriba: boolean } | null>(null);
  const idxSel = opciones.findIndex((o) => o.value === value);
  const [activa, setActiva] = useState(Math.max(idxSel, 0));
  const buscando = useRef({ texto: "", t: 0 });

  const seleccionada = idxSel >= 0 ? opciones[idxSel] : null;

  const colocar = useCallback(() => {
    const b = boton.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const espacioAbajo = window.innerHeight - r.bottom;
    const necesario = Math.min(altoMax, opciones.length * 38 + 12);
    const arriba = espacioAbajo < necesario + 8 && r.top > espacioAbajo;
    setPos({ left: r.left, top: arriba ? r.top : r.bottom, width: r.width, arriba });
  }, [altoMax, opciones.length]);

  function abrir() {
    if (disabled || opciones.length === 0) return;
    setActiva(Math.max(idxSel, 0));
    colocar();
    setCerrando(false);
    setAbierto(true);
  }

  const cerrar = useCallback(
    (devolverFoco = true) => {
      if (!abierto) return;
      setCerrando(true);
      window.setTimeout(() => {
        setAbierto(false);
        setCerrando(false);
      }, DURACION);
      if (devolverFoco) boton.current?.focus();
    },
    [abierto]
  );

  function elegir(i: number) {
    const o = opciones[i];
    if (!o || o.disabled) return;
    onChange(o.value);
    cerrar();
  }

  // Cerrar al pinchar fuera, y seguir a la caja si la página o el modal hacen scroll.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node;
      if (raiz.current?.contains(t) || lista.current?.contains(t)) return;
      cerrar(false);
    };
    const mover = () => colocar();
    // Escape se captura en window ANTES que nadie (fase de captura): cierra solo la
    // lista y no llega al modal que la contiene (que también cierra con Escape).
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || cerrando) return; // ya cerrándose: que Escape siga su curso (p. ej. al modal)
      e.preventDefault();
      e.stopImmediatePropagation();
      cerrar();
    };
    // En fase de CAPTURA: el modal corta la propagación de los mousedown que caen
    // dentro de él (para no cerrarse), y en fase normal este listener nunca los vería.
    document.addEventListener("mousedown", fuera, true);
    window.addEventListener("resize", mover);
    window.addEventListener("scroll", mover, true);
    window.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("mousedown", fuera, true);
      window.removeEventListener("resize", mover);
      window.removeEventListener("scroll", mover, true);
      window.removeEventListener("keydown", escape, true);
    };
  }, [abierto, cerrando, cerrar, colocar]);

  // Mantener visible la opción activa al moverse con el teclado.
  useLayoutEffect(() => {
    if (!abierto) return;
    const el = lista.current?.children[activa] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [activa, abierto]);

  function siguienteValida(desde: number, paso: 1 | -1): number {
    let i = desde;
    for (let n = 0; n < opciones.length; n++) {
      i = (i + paso + opciones.length) % opciones.length;
      if (!opciones[i].disabled) return i;
    }
    return desde;
  }

  function teclado(e: ReactKeyboardEvent) {
    if (disabled) return;
    if (!abierto) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        abrir();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiva((a) => siguienteValida(a, 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiva((a) => siguienteValida(a, -1));
        break;
      case "Home":
        e.preventDefault();
        setActiva(siguienteValida(-1, 1));
        break;
      case "End":
        e.preventDefault();
        setActiva(siguienteValida(0, -1));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        elegir(activa);
        break;
      case "Escape":
        // Solo cierra la lista, no el modal que la contiene.
        e.preventDefault();
        e.stopPropagation();
        cerrar();
        break;
      case "Tab":
        cerrar(false);
        break;
      default: {
        if (e.key.length !== 1) return;
        const ahora = Date.now();
        const b = buscando.current;
        b.texto = ahora - b.t < 700 ? b.texto + e.key.toLowerCase() : e.key.toLowerCase();
        b.t = ahora;
        const i = opciones.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(b.texto));
        if (i >= 0) setActiva(i);
      }
    }
  }

  const listaId = id ? `${id}-lista` : undefined;

  return (
    <div ref={raiz} className={"dd" + (abierto && !cerrando ? " abierto" : "") + (disabled ? " off" : "")} title={title}>
      <button
        ref={boton}
        type="button"
        id={id}
        className="dd-btn"
        disabled={disabled}
        onClick={() => (abierto ? cerrar() : abrir())}
        onKeyDown={teclado}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={listaId}
      >
        <span className={"txt" + (seleccionada ? "" : " ph")}>{seleccionada ? seleccionada.label : placeholder}</span>
        {seleccionada?.extra && <span className="extra">{seleccionada.extra}</span>}
        <svg className="chev" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {abierto &&
        pos &&
        createPortal(
          <ul
            ref={lista}
            id={listaId}
            role="listbox"
            className={"dd-lista" + (pos.arriba ? " arriba" : "") + (cerrando ? " cerrando" : "")}
            style={{ left: pos.left, top: pos.arriba ? undefined : pos.top + 4, bottom: pos.arriba ? window.innerHeight - pos.top + 4 : undefined, width: pos.width, maxHeight: altoMax }}
            onKeyDown={teclado}
            tabIndex={-1}
          >
            {opciones.map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                aria-disabled={o.disabled || undefined}
                className={"dd-op" + (i === activa ? " activa" : "") + (o.value === value ? " sel" : "") + (o.disabled ? " off" : "")}
                onMouseEnter={() => !o.disabled && setActiva(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(i)}
                title={o.label}
              >
                <span className="txt">{o.label}</span>
                {o.extra && <span className="extra">{o.extra}</span>}
                {o.value === value && (
                  <svg className="check" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </li>
            ))}
          </ul>,
          document.body
        )}
    </div>
  );
}
