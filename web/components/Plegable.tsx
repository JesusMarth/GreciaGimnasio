import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Contenedor cuyo alto se anima al cambiar su contenido (aparece/desaparece un
 * campo, cambia un chip…). Así un formulario "respira" en vez de dar un salto.
 * Mide el contenido con ResizeObserver y transiciona `height`; el primer pintado
 * no se anima (alto automático) para que el modal se abra ya con su tamaño.
 */
export function Plegable({ children, duracion = 220 }: { children: ReactNode; duracion?: number }) {
  const interior = useRef<HTMLDivElement>(null);
  const [alto, setAlto] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = interior.current;
    if (!el) return;
    const medir = () => setAlto(el.offsetHeight);
    medir();
    // Cambios de tamaño que no vienen de un re-render del padre (fuentes, imágenes…).
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Tras CADA render (el padre cambió el contenido) se re-mide en el mismo frame:
  // así la transición arranca al instante y no depende de que el ResizeObserver
  // llegue a tiempo (en pestañas en segundo plano el navegador lo retrasa).
  useLayoutEffect(() => {
    const el = interior.current;
    if (el && el.offsetHeight !== alto) setAlto(el.offsetHeight);
  });

  return (
    <div
      className="plegable"
      style={{ height: alto === null ? "auto" : alto, overflow: "hidden", transition: `height ${duracion}ms cubic-bezier(0.2, 0.9, 0.3, 1)` }}
    >
      <div ref={interior}>{children}</div>
    </div>
  );
}
