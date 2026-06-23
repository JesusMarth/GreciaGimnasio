import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.ts";
import { capitalizar } from "../format.ts";
import { EstadoBadge } from "../components/Badges.tsx";
import { SocioFormModal } from "../components/SocioFormModal.tsx";
import type { Socio } from "../types.ts";

export function Socios() {
  const [socios, setSocios] = useState<Socio[]>([]);
  const [buscar, setBuscar] = useState("");
  const [nuevo, setNuevo] = useState(false);
  const [error, setError] = useState("");
  const nav = useNavigate();

  function recargar(q = buscar) {
    api.socios(q).then(setSocios).catch((e) => setError(e.message));
  }
  useEffect(() => {
    const t = setTimeout(() => recargar(buscar), 200);
    return () => clearTimeout(t);
  }, [buscar]);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Miembros</div>
          <h1>Socios</h1>
          <div className="sub">{socios.length} socios</div>
        </div>
        <button className="btn primary" onClick={() => setNuevo(true)}>
          + Nuevo socio
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card" style={{ overflow: "hidden" }}>
        <div className="card-pad" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="search">
            <span className="ico">⌕</span>
            <input
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              placeholder="Buscar por nombre o teléfono…"
            />
          </div>
        </div>

        {socios.length === 0 ? (
          <div className="center-box">
            {buscar ? "Ningún socio coincide con la búsqueda." : "Aún no hay socios. Crea el primero con “Nuevo socio”."}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Teléfono</th>
                <th>Actividades</th>
                <th>Estado cuota</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {socios.map((s) => (
                <tr key={s.id} className="clickable" onClick={() => nav(`/socios/${s.id}`)}>
                  <td>
                    <span className="nombre">{s.nombre}</span>
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
                  <td style={{ textAlign: "right", color: "var(--text-faint)" }}>›</td>
                </tr>
              ))}
            </tbody>
          </table>
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
    </>
  );
}
