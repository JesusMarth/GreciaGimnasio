import { useEffect, type ReactNode } from "react";

interface Props {
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
  pie?: ReactNode;
  ancho?: boolean;
}

export function Modal({ titulo, onCerrar, children, pie, ancho }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCerrar]);

  return (
    <div className="overlay" onMouseDown={onCerrar}>
      <div className={"modal" + (ancho ? " wide" : "")} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{titulo}</h3>
          <button className="x" onClick={onCerrar} aria-label="Cerrar">
            ×
          </button>
        </div>
        {children}
        {pie && <div className="modal-foot">{pie}</div>}
      </div>
    </div>
  );
}
