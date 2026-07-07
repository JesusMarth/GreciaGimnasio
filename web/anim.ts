import { useEffect, useRef, useState } from "react";

/** Contador animado: sube (o baja) hasta el objetivo con easing suave.
 *  Usa setTimeout (no rAF) para funcionar también en pestañas en segundo plano,
 *  y respeta `prefers-reduced-motion`. Al terminar muestra el valor exacto. */
export function useContador(objetivo: number): number {
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
