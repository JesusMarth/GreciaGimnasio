import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.ts";
import { euros, fecha, estadoTexto, colorEstado, capitalizar } from "../format.ts";
import { PagoModal } from "../components/PagoModal.tsx";
import type { Dashboard, DashItem } from "../types.ts";

export function Panel() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [cobrar, setCobrar] = useState<DashItem | null>(null);

  function recargar() {
    api.dashboard().then(setData).catch((e) => setError(e.message));
  }
  useEffect(recargar, []);

  if (error) return <div className="error-banner">{error}</div>;
  if (!data) return <div className="center-box">Cargando…</div>;

  const { resumen, ingresosMes } = data;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Panel</h1>
          <div className="sub">Hoy es {fecha(data.hoy)} · {resumen.totalActivos} socios activos</div>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat rojo">
          <div className="bar" />
          <div className="label">Por cobrar</div>
          <div className="value">{resumen.porCobrar}</div>
        </div>
        <div className="stat ambar">
          <div className="bar" />
          <div className="label">Vencen pronto</div>
          <div className="value">{resumen.pronto}</div>
        </div>
        <div className="stat verde">
          <div className="bar" />
          <div className="label">Al día</div>
          <div className="value">{resumen.aldia}</div>
        </div>
        <div className="stat azul">
          <div className="bar" />
          <div className="label">Ingresos del mes</div>
          <div className="value">{euros(ingresosMes.total)}</div>
        </div>
      </div>

      <div className="cols">
        <Columna titulo="Por cobrar / atrasados" color="rojo" items={data.porCobrar} onCobrar={setCobrar} vacio="Nadie pendiente. 🎉" />
        <Columna titulo="Vencen pronto" color="ambar" items={data.pronto} onCobrar={setCobrar} vacio="Nada vence esta semana." />
        <Columna titulo="Al día" color="verde" items={data.aldia} onCobrar={setCobrar} vacio="Sin cuotas al día todavía." />
      </div>

      {ingresosMes.porActividad.length > 0 && (
        <div className="card card-pad" style={{ marginTop: 22 }}>
          <div className="section-title">Ingresos de este mes por actividad</div>
          <div className="tag-list">
            {ingresosMes.porActividad.map((a) => (
              <span key={a.actividad} className="pill-act" style={{ fontSize: 13, padding: "5px 12px" }}>
                {capitalizar(a.actividad)}: <strong>{euros(a.total)}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {cobrar && (
        <PagoModal
          socioId={cobrar.socioId}
          socioNombre={cobrar.socioNombre}
          suscripcionIdPre={cobrar.suscripcionId}
          onCerrar={() => setCobrar(null)}
          onHecho={() => {
            setCobrar(null);
            recargar();
          }}
        />
      )}
    </>
  );
}

function Columna({
  titulo,
  color,
  items,
  onCobrar,
  vacio,
}: {
  titulo: string;
  color: string;
  items: DashItem[];
  onCobrar: (i: DashItem) => void;
  vacio: string;
}) {
  return (
    <div>
      <div className="col-head">
        <span className={"dot " + color} /> {titulo}
        <span className="count">{items.length}</span>
      </div>
      {items.length === 0 && <div className="empty-col">{vacio}</div>}
      {items.map((i) => (
        <div key={i.suscripcionId} className={"item " + colorEstado(i.estado)}>
          <div className="top">
            <Link to={`/socios/${i.socioId}`} className="nombre">
              {i.socioNombre}
            </Link>
            <strong>{euros(i.importe)}</strong>
          </div>
          <div className="meta">
            <span className="pill-act">{capitalizar(i.actividad)}</span>
            {i.etiqueta && <span>{i.etiqueta}</span>}
          </div>
          <div className="estado-linea">
            <span className="muted">{estadoTexto(i.estado, i.dias)}</span>
            <span className="muted">{i.pagadoHasta ? `hasta ${fecha(i.pagadoHasta)}` : ""}</span>
          </div>
          <div className="acciones">
            <button className="btn primary sm" onClick={() => onCobrar(i)}>
              Cobrar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
