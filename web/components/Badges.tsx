import { ESTADO_LABEL, colorEstado, EXPLICA_ESTADO } from "../format.ts";
import type { EstadoCuota } from "../types.ts";

export function EstadoBadge({ estado }: { estado: EstadoCuota | null }) {
  if (!estado) return <span className="badge gris" title="No tiene cuotas activas.">Sin cuotas</span>;
  return (
    <span className={"badge " + colorEstado(estado)} title={EXPLICA_ESTADO[estado]}>
      {ESTADO_LABEL[estado]}
    </span>
  );
}
