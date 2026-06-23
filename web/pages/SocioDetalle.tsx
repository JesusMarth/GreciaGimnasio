import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api } from "../api.ts";
import { euros, fecha, estadoTexto, colorEstado, capitalizar } from "../format.ts";
import { EstadoBadge } from "../components/Badges.tsx";
import { PagoModal } from "../components/PagoModal.tsx";
import { SocioFormModal } from "../components/SocioFormModal.tsx";
import { SuscripcionFormModal } from "../components/SuscripcionFormModal.tsx";
import type { Pago, Socio, Suscripcion } from "../types.ts";

export function SocioDetalle() {
  const { id } = useParams();
  const socioId = Number(id);
  const nav = useNavigate();

  const [socio, setSocio] = useState<Socio | null>(null);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [error, setError] = useState("");

  const [editando, setEditando] = useState(false);
  const [cobrar, setCobrar] = useState<{ pre?: number } | null>(null);
  const [subForm, setSubForm] = useState<{ sub?: Suscripcion } | null>(null);

  const recargar = useCallback(() => {
    Promise.all([api.socio(socioId), api.pagosDeSocio(socioId)])
      .then(([s, p]) => {
        setSocio(s);
        setPagos(p);
      })
      .catch((e) => setError(e.message));
  }, [socioId]);

  useEffect(recargar, [recargar]);

  async function borrarSocio() {
    if (!socio) return;
    if (!confirm(`¿Borrar a ${socio.nombre} y todo su historial? Esto no se puede deshacer.`)) return;
    await api.borrarSocio(socioId);
    nav("/socios");
  }

  async function borrarSuscripcion(sub: Suscripcion) {
    if (!confirm(`¿Quitar la actividad "${capitalizar(sub.actividad)}" de este socio?`)) return;
    await api.borrarSuscripcion(sub.id);
    recargar();
  }

  async function borrarPago(p: Pago) {
    if (!confirm(`¿Borrar el pago de ${euros(p.total)} del ${fecha(p.fecha)}?`)) return;
    await api.borrarPago(p.id);
    recargar();
  }

  if (error) return <div className="error-banner">{error}</div>;
  if (!socio) return <div className="center-box">Cargando…</div>;

  const activas = socio.suscripciones.filter((x) => x.activa);
  const inactivas = socio.suscripciones.filter((x) => !x.activa);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="sub">
            <Link to="/socios" style={{ color: "var(--text-soft)", textDecoration: "none" }}>
              ‹ Socios
            </Link>
          </div>
          <div className="eyebrow">Ficha de socio</div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {socio.nombre} <EstadoBadge estado={socio.estadoResumen} />
            {socio.estado === "baja" && <span className="badge gris">Baja</span>}
          </h1>
          <div className="sub">Alta: {fecha(socio.fechaAlta)}</div>
        </div>
        <div className="btn-row">
          <button className="btn primary" onClick={() => setCobrar({})} disabled={activas.length === 0}>
            € Registrar pago
          </button>
          <button className="btn" onClick={() => setEditando(true)}>
            Editar
          </button>
          <button className="btn danger" onClick={borrarSocio}>
            Borrar
          </button>
        </div>
      </div>

      <div className="grid-2">
        {/* Columna izquierda: actividades */}
        <div className="card card-pad">
          <div className="section-title">
            Actividades y cuotas
            <button className="btn sm" onClick={() => setSubForm({})}>
              + Añadir actividad
            </button>
          </div>

          {activas.length === 0 && inactivas.length === 0 && (
            <div className="center-box" style={{ padding: "30px 10px" }}>
              Sin actividades. Añade gimnasio, karate o pilates.
            </div>
          )}

          {activas.map((sub) => (
            <SubCard key={sub.id} sub={sub} onCobrar={() => setCobrar({ pre: sub.id })} onEditar={() => setSubForm({ sub })} onBorrar={() => borrarSuscripcion(sub)} />
          ))}

          {inactivas.length > 0 && (
            <>
              <div className="muted" style={{ fontSize: 12, margin: "14px 0 8px", fontWeight: 600 }}>
                Inactivas
              </div>
              {inactivas.map((sub) => (
                <SubCard key={sub.id} sub={sub} onCobrar={() => setCobrar({ pre: sub.id })} onEditar={() => setSubForm({ sub })} onBorrar={() => borrarSuscripcion(sub)} />
              ))}
            </>
          )}
        </div>

        {/* Columna derecha: datos + historial */}
        <div>
          <div className="card card-pad" style={{ marginBottom: 18 }}>
            <div className="section-title">Datos</div>
            <div className="kv">
              <span className="k">Teléfono</span>
              <span>{socio.telefono || "—"}</span>
            </div>
            <div className="kv">
              <span className="k">Email</span>
              <span>{socio.email || "—"}</span>
            </div>
            <div className="kv">
              <span className="k">Nacimiento</span>
              <span>{fecha(socio.fechaNacimiento)}</span>
            </div>
            {socio.notas && (
              <div className="kv" style={{ borderBottom: "none" }}>
                <span className="k">Notas</span>
                <span>{socio.notas}</span>
              </div>
            )}
          </div>

          <div className="card card-pad">
            <div className="section-title">Historial de pagos</div>
            {pagos.length === 0 && <div className="muted" style={{ fontSize: 13 }}>Aún no hay pagos registrados.</div>}
            {pagos.map((p) => (
              <div key={p.id} className="sub-card verde" style={{ borderLeftColor: "var(--border)" }}>
                <div className="top" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>{euros(p.total)}</strong>
                  <span className="muted" style={{ fontSize: 12.5 }}>
                    {fecha(p.fecha)} · {capitalizar(p.metodo)}
                  </span>
                </div>
                <div className="meta" style={{ marginTop: 6, fontSize: 12.5, color: "var(--text-soft)" }}>
                  {p.lineas.map((l, i) => (
                    <div key={i}>
                      {capitalizar(l.actividad)}
                      {l.concepto ? ` · ${l.concepto}` : ""}: {euros(l.importe)}
                      {l.periodoHasta ? ` (hasta ${fecha(l.periodoHasta)})` : ""}
                    </div>
                  ))}
                  {p.notas && <div style={{ fontStyle: "italic", marginTop: 3 }}>{p.notas}</div>}
                </div>
                <div className="acciones" style={{ marginTop: 8 }}>
                  <button className="btn ghost sm danger" onClick={() => borrarPago(p)}>
                    Borrar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {cobrar && (
        <PagoModal
          socioId={socioId}
          socioNombre={socio.nombre}
          suscripcionIdPre={cobrar.pre}
          onCerrar={() => setCobrar(null)}
          onHecho={() => {
            setCobrar(null);
            recargar();
          }}
        />
      )}
      {editando && (
        <SocioFormModal
          socio={socio}
          onCerrar={() => setEditando(false)}
          onHecho={() => {
            setEditando(false);
            recargar();
          }}
        />
      )}
      {subForm && (
        <SuscripcionFormModal
          socioId={socioId}
          suscripcion={subForm.sub}
          onCerrar={() => setSubForm(null)}
          onHecho={() => {
            setSubForm(null);
            recargar();
          }}
        />
      )}
    </>
  );
}

function SubCard({
  sub,
  onCobrar,
  onEditar,
  onBorrar,
}: {
  sub: Suscripcion;
  onCobrar: () => void;
  onEditar: () => void;
  onBorrar: () => void;
}) {
  return (
    <div className={"sub-card " + (sub.activa ? colorEstado(sub.estado) : "gris")}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div>
          <span className="pill-act">{capitalizar(sub.actividad)}</span>
          {sub.etiqueta && <span style={{ marginLeft: 8, fontWeight: 600 }}>{sub.etiqueta}</span>}
        </div>
        <strong>{euros(sub.importe)}</strong>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
        <EstadoBadge estado={sub.activa ? sub.estado : null} />
        <span className="muted" style={{ fontSize: 12.5 }}>
          {sub.activa ? estadoTexto(sub.estado, sub.dias) : "Inactiva"}
          {sub.pagadoHasta ? ` · hasta ${fecha(sub.pagadoHasta)}` : ""}
        </span>
      </div>
      <div className="acciones" style={{ marginTop: 10 }}>
        <button className="btn primary sm" onClick={onCobrar}>
          Cobrar
        </button>
        <button className="btn sm" onClick={onEditar}>
          Editar
        </button>
        <button className="btn ghost sm danger" onClick={onBorrar}>
          Quitar
        </button>
      </div>
    </div>
  );
}
