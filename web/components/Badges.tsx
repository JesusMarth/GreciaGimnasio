import { ESTADO_LABEL } from "../format.ts";
import { colorEstado } from "../format.ts";
import type { EstadoCuota } from "../types.ts";

export function EstadoBadge({ estado }: { estado: EstadoCuota | null }) {
  if (!estado) return <span className="badge gris">Sin cuotas</span>;
  return <span className={"badge " + colorEstado(estado)}>{ESTADO_LABEL[estado]}</span>;
}
