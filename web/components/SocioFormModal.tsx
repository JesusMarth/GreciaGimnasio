import { useState } from "react";
import { Modal } from "./Modal.tsx";
import { api } from "../api.ts";
import { hoyISO } from "../format.ts";
import type { Socio } from "../types.ts";

interface Props {
  socio?: Socio; // si viene, es edicion
  onCerrar: () => void;
  onHecho: (s: Socio) => void;
}

export function SocioFormModal({ socio, onCerrar, onHecho }: Props) {
  const [nombre, setNombre] = useState(socio?.nombre ?? "");
  const [apellidos, setApellidos] = useState(socio?.apellidos ?? "");
  const [telefono, setTelefono] = useState(socio?.telefono ?? "");
  const [email, setEmail] = useState(socio?.email ?? "");
  const [dni, setDni] = useState(socio?.dni ?? "");
  const [sexo, setSexo] = useState(socio?.sexo ?? "");
  const [fechaAlta, setFechaAlta] = useState(socio?.fechaAlta ?? hoyISO());
  const [fechaNacimiento, setFechaNacimiento] = useState(socio?.fechaNacimiento ?? "");
  const [estado, setEstado] = useState(socio?.estado ?? "activo");
  const [notas, setNotas] = useState(socio?.notas ?? "");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (!nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    setGuardando(true);
    setError("");
    const datos = { nombre, apellidos, telefono, email, dni, sexo, fechaAlta, fechaNacimiento: fechaNacimiento || null, estado, notas };
    try {
      const s = socio ? await api.editarSocio(socio.id, datos) : await api.crearSocio(datos);
      onHecho(s);
    } catch (e: any) {
      setError(e.message);
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo={socio ? "Editar socio" : "Nuevo socio"}
      onCerrar={onCerrar}
      pie={
        <>
          <button className="btn ghost" onClick={onCerrar}>
            Cancelar
          </button>
          <button className="btn primary" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : socio ? "Guardar cambios" : "Crear socio"}
          </button>
        </>
      }
    >
      <div className="modal-body">
        {error && <div className="error-banner">{error}</div>}
        <div className="row2">
          <div className="field">
            <label>Nombre *</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus placeholder="p. ej. María" />
          </div>
          <div className="field">
            <label>Apellidos</label>
            <input value={apellidos} onChange={(e) => setApellidos(e.target.value)} placeholder="p. ej. López García" />
          </div>
        </div>
        <div className="row2">
          <div className="field">
            <label>Teléfono</label>
            <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="600 000 000" />
          </div>
          <div className="field">
            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="opcional" />
          </div>
        </div>
        <div className="row2">
          <div className="field">
            <label>DNI / NIF</label>
            <input value={dni} onChange={(e) => setDni(e.target.value)} placeholder="opcional — para recibos con validez fiscal" />
          </div>
          <div className="field">
            <label>Sexo</label>
            <div className="sexo-toggle">
              <button type="button" className={"sexo-op" + (sexo === "hombre" ? " on hombre" : "")} onClick={() => setSexo(sexo === "hombre" ? "" : "hombre")} aria-pressed={sexo === "hombre"}>
                <svg className="sx" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="10" cy="14" r="6" />
                  <path d="M14.2 9.8 L20.5 3.5 M15 3.5 H20.5 V9" />
                </svg>
                Hombre
              </button>
              <button type="button" className={"sexo-op" + (sexo === "mujer" ? " on mujer" : "")} onClick={() => setSexo(sexo === "mujer" ? "" : "mujer")} aria-pressed={sexo === "mujer"}>
                <svg className="sx" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="9" r="6" />
                  <path d="M12 15 V21.5 M9 18.5 H15" />
                </svg>
                Mujer
              </button>
            </div>
          </div>
        </div>
        <div className="row2">
          <div className="field">
            <label>Fecha de alta</label>
            <input type="date" value={fechaAlta} onChange={(e) => setFechaAlta(e.target.value)} />
          </div>
          <div className="field">
            <label>Fecha de nacimiento</label>
            <input type="date" value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} />
          </div>
        </div>
        {socio && (
          <div className="field">
            <label>Estado</label>
            <select value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="activo">Activo</option>
              <option value="baja">Baja</option>
            </select>
          </div>
        )}
        <div className="field">
          <label>Notas</label>
          <textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="opcional" />
        </div>
      </div>
    </Modal>
  );
}
