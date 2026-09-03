import { ESTADO_LABEL, ESTADO_LABEL_BONO, colorEstado, EXPLICA_ESTADO, EXPLICA_ESTADO_BONO } from "../format.ts";
import type { EstadoCuota } from "../types.ts";

/** Chapa de estado de cuota. Con `bono`, habla de sesiones (Con sesiones / Quedan pocas / Agotado / Sin bono). */
export function EstadoBadge({ estado, bono = false }: { estado: EstadoCuota | null; bono?: boolean }) {
  if (!estado) return <span className="badge gris" title="No tiene cuotas activas.">Sin cuotas</span>;
  const label = bono ? ESTADO_LABEL_BONO : ESTADO_LABEL;
  const explica = bono ? EXPLICA_ESTADO_BONO : EXPLICA_ESTADO;
  return (
    <span className={"badge " + colorEstado(estado)} title={explica[estado]}>
      {label[estado]}
    </span>
  );
}
