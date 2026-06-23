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
  const [telefono, setTelefono] = useState(socio?.telefono ?? "");
  const [email, setEmail] = useState(socio?.email ?? "");
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
    const datos = { nombre, telefono, email, fechaAlta, fechaNacimiento: fechaNacimiento || null, estado, notas };
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
        <div className="field">
          <label>Nombre y apellidos *</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus placeholder="p. ej. María López" />
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
