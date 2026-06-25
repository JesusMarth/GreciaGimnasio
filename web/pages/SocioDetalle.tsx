import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api } from "../api.ts";
import { euros, fecha, estadoTexto, colorEstado, capitalizar, descargar } from "../format.ts";
import { EstadoBadge } from "../components/Badges.tsx";
import { PagoModal } from "../components/PagoModal.tsx";
import { SocioFormModal } from "../components/SocioFormModal.tsx";
import { SuscripcionFormModal } from "../components/SuscripcionFormModal.tsx";
import { useConfirm } from "../components/Confirmar.tsx";
import { AyudaSocioDetalle } from "../components/Ayuda.tsx";
import type { Pago, Socio, Suscripcion } from "../types.ts";

export function SocioDetalle() {
  const { id } = useParams();
  const socioId = Number(id);
  const nav = useNavigate();
  const confirmar = useConfirm();

  const [socio, setSocio] = useState<Socio | null>(null);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [error, setError] = useState("");

  const [editando, setEditando] = useState(false);
  const [cobrar, setCobrar] = useState<{ pre?: number } | null>(null);
  const [subForm, setSubForm] = useState<{ sub?: Suscripcion } | null>(null);
  const [avisoMsg, setAvisoMsg] = useState<{ ok: boolean; txt: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

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
    const ok = await confirmar({
      titulo: "Borrar socio",
      mensaje: `¿Borrar a ${socio.nombre} y todo su historial? Esto no se puede deshacer.`,
      confirmar: "Borrar",
      peligro: true,
    });
    if (!ok) return;
    try {
      await api.borrarSocio(socioId);
      nav("/socios");
    } catch (e: any) {
      setAvisoMsg({ ok: false, txt: e.message });
    }
  }

  async function borrarSuscripcion(sub: Suscripcion) {
    const ok = await confirmar({
      titulo: "Quitar actividad",
      mensaje: `¿Quitar la actividad "${capitalizar(sub.actividad)}" de este socio?`,
      confirmar: "Quitar",
      peligro: true,
    });
    if (!ok) return;
    try {
      await api.borrarSuscripcion(sub.id);
      recargar();
    } catch (e: any) {
      setAvisoMsg({ ok: false, txt: e.message });
    }
  }

  async function borrarPago(p: Pago) {
    const ok = await confirmar({
      titulo: "Borrar pago",
      mensaje: `¿Borrar el pago de ${euros(p.total)} del ${fecha(p.fecha)}?`,
      confirmar: "Borrar",
      peligro: true,
    });
    if (!ok) return;
    try {
      await api.borrarPago(p.id);
      recargar();
    } catch (e: any) {
      setAvisoMsg({ ok: false, txt: e.message });
    }
  }

  // Baja/alta del socio entero: lo saca (o devuelve) del Panel y los avisos, sin borrarlo.
  async function toggleEstadoSocio() {
    if (!socio) return;
    try {
      await api.editarSocio(socioId, { estado: socio.estado === "baja" ? "activo" : "baja" });
      recargar();
    } catch (e: any) {
      setAvisoMsg({ ok: false, txt: e.message });
    }
  }

  // Pausar/reactivar una actividad concreta (deja de contar para cobros y avisos).
  async function toggleSuscripcion(sub: Suscripcion) {
    try {
      await api.editarSuscripcion(sub.id, { activa: !sub.activa });
      recargar();
    } catch (e: any) {
      setAvisoMsg({ ok: false, txt: e.message });
    }
  }

  async function avisarPorEmail() {
    if (enviando) return;
    setEnviando(true);
    setAvisoMsg(null);
    try {
      const r = await api.avisarEmail(socioId);
      setAvisoMsg({ ok: true, txt: `Aviso enviado a ${r.email}.` });
    } catch (e: any) {
      setAvisoMsg({ ok: false, txt: e.message });
    } finally {
      setEnviando(false);
    }
  }

  async function enviarRecibo(p: Pago) {
    if (enviando) return;
    setEnviando(true);
    setAvisoMsg(null);
    try {
      const r = await api.enviarRecibo(p.id);
      setAvisoMsg({ ok: true, txt: `Recibo enviado a ${r.email}.` });
    } catch (e: any) {
      setAvisoMsg({ ok: false, txt: e.message });
    } finally {
      setEnviando(false);
    }
  }

  if (error) return <div className="error-banner">{error}</div>;
  if (!socio) return <div className="center-box">Cargando…</div>;

  const activas = socio.suscripciones.filter((x) => x.activa);
  const inactivas = socio.suscripciones.filter((x) => !x.activa);

  return (
    <div className="lienzo ficha">
      <Link to="/socios" className="volver">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Socios
      </Link>
      <div className="page-head">
        <div>
          <div className="eyebrow">Ficha de socio</div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {socio.nombre} <EstadoBadge estado={socio.estadoResumen} />
            {socio.estado === "baja" && <span className="badge gris">Baja</span>}
          </h1>
          <div className="sub">Alta: {fecha(socio.fechaAlta)}</div>
        </div>
        <div className="btn-row" style={{ flexWrap: "wrap" }}>
          <button className="btn primary" onClick={() => setCobrar({})} disabled={activas.length === 0}>
            € Registrar pago
          </button>
          <button className="btn" onClick={avisarPorEmail} disabled={enviando}>
            Avisar por email
          </button>
          <button className="btn" onClick={() => setEditando(true)}>
            Editar
          </button>
          <button className="btn" onClick={toggleEstadoSocio}>
            {socio.estado === "baja" ? "Reactivar socio" : "Dar de baja"}
          </button>
          <button className="btn danger" onClick={borrarSocio}>
            Borrar
          </button>
          <AyudaSocioDetalle />
        </div>
      </div>

      {avisoMsg && <div className={avisoMsg.ok ? "ok-banner" : "error-banner"}>{avisoMsg.txt}</div>}

      <div className="grid-2">
        {/* Columna izquierda: actividades */}
        <div className="card card-pad">
          <div className="section-title">
            Actividades y cuotas
            <button className="btn sm" onClick={() => setSubForm({})}>
              + Añadir actividad
            </button>
          </div>

          <div className="ficha-scroll">
          {activas.length === 0 && inactivas.length === 0 && (
            <div className="center-box" style={{ padding: "30px 10px" }}>
              Sin actividades. Añade gimnasio, karate o pilates.
            </div>
          )}

          {activas.map((sub) => (
            <SubCard key={sub.id} sub={sub} onCobrar={() => setCobrar({ pre: sub.id })} onEditar={() => setSubForm({ sub })} onBorrar={() => borrarSuscripcion(sub)} onToggleActiva={() => toggleSuscripcion(sub)} />
          ))}

          {inactivas.length > 0 && (
            <>
              <div className="muted" style={{ fontSize: 12, margin: "14px 0 8px", fontWeight: 600 }}>
                Inactivas
              </div>
              {inactivas.map((sub) => (
                <SubCard key={sub.id} sub={sub} onCobrar={() => setCobrar({ pre: sub.id })} onEditar={() => setSubForm({ sub })} onBorrar={() => borrarSuscripcion(sub)} onToggleActiva={() => toggleSuscripcion(sub)} />
              ))}
            </>
          )}
          </div>
        </div>

        {/* Columna derecha: datos + historial */}
        <div className="ficha-col-der">
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
            <div className="section-title">
              Historial de pagos{pagos.length > 0 ? ` · ${pagos.length}` : ""}
              <button className="btn sm" onClick={() => descargar(api.exportSocioUrl(socioId))}>
                Exportar Excel
              </button>
            </div>
            {pagos.length === 0 && <div className="muted" style={{ fontSize: 13 }}>Aún no hay pagos registrados.</div>}
            <div className="historial-scroll">
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
                  <button className="btn sm" onClick={() => window.open(api.reciboUrl(p.id), "_blank")}>
                    Recibo PDF
                  </button>
                  <button className="btn sm" onClick={() => enviarRecibo(p)} disabled={enviando}>
                    Enviar recibo
                  </button>
                  <button className="btn ghost sm danger" onClick={() => borrarPago(p)}>
                    Borrar
                  </button>
                </div>
              </div>
            ))}
            </div>
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
    </div>
  );
}

function SubCard({
  sub,
  onCobrar,
  onEditar,
  onBorrar,
  onToggleActiva,
}: {
  sub: Suscripcion;
  onCobrar: () => void;
  onEditar: () => void;
  onBorrar: () => void;
  onToggleActiva: () => void;
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
        {sub.activa ? (
          <>
            <button className="btn primary sm" onClick={onCobrar}>
              Cobrar
            </button>
            <button className="btn sm" onClick={onEditar}>
              Editar
            </button>
            <button className="btn ghost sm" onClick={onToggleActiva}>
              Pausar
            </button>
          </>
        ) : (
          <>
            <button className="btn sm" onClick={onToggleActiva}>
              Reactivar
            </button>
            <button className="btn sm" onClick={onEditar}>
              Editar
            </button>
          </>
        )}
        <button className="btn ghost sm danger" onClick={onBorrar}>
          Quitar
        </button>
      </div>
    </div>
  );
}
