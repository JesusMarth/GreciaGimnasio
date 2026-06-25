import { useEffect, useState } from "react";
import { api } from "../api.ts";
import { AyudaAjustes } from "../components/Ayuda.tsx";

// Valores por defecto pensados para Gmail (lo más común). Editables.
const PRESET = { host: "smtp.gmail.com", port: 465, secure: true };

export function Ajustes() {
  // --- Correo (SMTP) ---
  const [remitente, setRemitente] = useState("");
  const [usuario, setUsuario] = useState("");
  const [pass, setPass] = useState("");
  const [host, setHost] = useState(PRESET.host);
  const [port, setPort] = useState<number>(PRESET.port);
  const [secure, setSecure] = useState(PRESET.secure);
  const [tienePass, setTienePass] = useState(false);

  // --- Datos del recibo ---
  const [nombreF, setNombreF] = useState("");
  const [nif, setNif] = useState("");
  const [direccion, setDireccion] = useState("");
  const [tipoDoc, setTipoDoc] = useState("Recibo");
  const [iva, setIva] = useState("no");
  const [ivaTipo, setIvaTipo] = useState<number>(21);
  const [pie, setPie] = useState("");

  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [guardandoD, setGuardandoD] = useState(false);

  useEffect(() => {
    api
      .configEmail()
      .then((c) => {
        setRemitente(c.remitente);
        setUsuario(c.usuario);
        setHost(c.host || PRESET.host);
        setPort(c.port || PRESET.port);
        setSecure(c.host ? c.secure : PRESET.secure);
        setTienePass(c.tienePass);
      })
      .catch((e) => setError(e.message));
    api
      .datosRecibo()
      .then((d) => {
        setNombreF(d.nombre);
        setNif(d.nif);
        setDireccion(d.direccion);
        setTipoDoc(d.tipoDoc || "Recibo");
        setIva(d.iva || "no");
        setIvaTipo(d.ivaTipo || 21);
        setPie(d.pie);
      })
      .catch(() => {});
  }, []);

  async function guardarCorreo() {
    setGuardando(true);
    setError("");
    setAviso("");
    try {
      await api.guardarConfigEmail({ remitente, usuario, host, port, secure, pass });
      if (pass) setTienePass(true);
      setPass("");
      setAviso("Configuración de correo guardada.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  async function probar() {
    setProbando(true);
    setError("");
    setAviso("");
    try {
      await api.probarEmail();
      setAviso(`Correo de prueba enviado a ${usuario}. Revisa tu bandeja.`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setProbando(false);
    }
  }

  async function guardarDatos() {
    setGuardandoD(true);
    setError("");
    setAviso("");
    try {
      await api.guardarDatosRecibo({ nombre: nombreF, nif, direccion, tipoDoc, iva, ivaTipo, pie });
      setAviso("Datos del recibo guardados.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGuardandoD(false);
    }
  }

  return (
    <div className="lienzo">
      <div className="page-head">
        <div>
          <div className="eyebrow">Configuración</div>
          <h1>Ajustes</h1>
          <div className="sub">Correo para los avisos y datos que salen en los recibos.</div>
        </div>
        <AyudaAjustes />
      </div>

      {error && <div className="error-banner">{error}</div>}
      {aviso && <div className="ok-banner">{aviso}</div>}

      <div className="grid-2">
        <div className="card card-pad">
          <div className="section-title">Correo de envío</div>

          <div className="field">
            <label>Nombre que verá el socio</label>
            <input value={remitente} onChange={(e) => setRemitente(e.target.value)} placeholder="p. ej. Gimnasio Grecia" />
          </div>
          <div className="field">
            <label>Tu correo (desde el que se envía)</label>
            <input value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="gimnasio@gmail.com" />
          </div>
          <div className="field">
            <label>Contraseña de aplicación</label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder={tienePass ? "•••••••• (guardada — déjala vacía para no cambiarla)" : "contraseña de aplicación"}
            />
          </div>

          <div className="row3">
            <div className="field">
              <label>Servidor (SMTP)</label>
              <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.gmail.com" />
            </div>
            <div className="field">
              <label>Puerto</label>
              <input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} />
            </div>
            <div className="field">
              <label>Seguridad</label>
              <select value={secure ? "ssl" : "starttls"} onChange={(e) => setSecure(e.target.value === "ssl")}>
                <option value="ssl">SSL (465)</option>
                <option value="starttls">STARTTLS (587)</option>
              </select>
            </div>
          </div>

          <div className="btn-row" style={{ marginTop: 6 }}>
            <button className="btn primary" onClick={guardarCorreo} disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar correo"}
            </button>
            <button className="btn" onClick={probar} disabled={probando || !tienePass}>
              {probando ? "Enviando…" : "Enviar correo de prueba"}
            </button>
          </div>
        </div>

        <div className="card card-pad">
          <div className="section-title">Cómo configurar el correo (Gmail)</div>
          <p style={{ marginTop: 0, lineHeight: 1.7 }}>
            Con Gmail <strong>no sirve tu contraseña normal</strong>: hay que crear una <strong>contraseña de aplicación</strong>.
          </p>
          <ol style={{ margin: "0 0 4px 18px", padding: 0, lineHeight: 1.8 }}>
            <li>Activa la <strong>verificación en dos pasos</strong> en tu cuenta de Google.</li>
            <li>Entra en <strong>Cuenta de Google → Seguridad → Contraseñas de aplicaciones</strong>.</li>
            <li>Crea una para “Correo” y copia los 16 caracteres.</li>
            <li>Pégala aquí, con servidor <code>smtp.gmail.com</code> y SSL (465).</li>
          </ol>
          <div className="hint" style={{ marginTop: 10 }}>
            Otros proveedores (Outlook, el correo de tu hosting…) también valen: pon su servidor SMTP, puerto y credenciales.
          </div>
        </div>
      </div>

      <div className="card card-pad" style={{ marginTop: 18 }}>
        <div className="section-title">Datos para los recibos</div>
        <div className="row2">
          <div className="field">
            <label>Nombre o razón social</label>
            <input value={nombreF} onChange={(e) => setNombreF(e.target.value)} placeholder="p. ej. Gimnasio Grecia, S.L." />
          </div>
          <div className="field">
            <label>NIF / CIF</label>
            <input value={nif} onChange={(e) => setNif(e.target.value)} placeholder="B12345678" />
          </div>
        </div>
        <div className="field">
          <label>Dirección</label>
          <input value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Calle, nº, CP, localidad" />
        </div>
        <div className="row3">
          <div className="field">
            <label>Tipo de documento</label>
            <select value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value)}>
              <option value="Recibo">Recibo</option>
              <option value="Factura">Factura</option>
            </select>
          </div>
          <div className="field">
            <label>IVA</label>
            <select value={iva} onChange={(e) => setIva(e.target.value)}>
              <option value="no">No desglosar (recibo simple)</option>
              <option value="incluido">Incluido en el precio</option>
              <option value="exento">Exento</option>
            </select>
          </div>
          <div className="field">
            <label>Tipo de IVA (%)</label>
            <input type="number" value={ivaTipo} disabled={iva !== "incluido"} onChange={(e) => setIvaTipo(Number(e.target.value))} />
          </div>
        </div>
        <div className="field">
          <label>Texto al pie (opcional)</label>
          <input value={pie} onChange={(e) => setPie(e.target.value)} placeholder="p. ej. Gracias por tu confianza." />
        </div>
        <div className="btn-row" style={{ marginTop: 6 }}>
          <button className="btn primary" onClick={guardarDatos} disabled={guardandoD}>
            {guardandoD ? "Guardando…" : "Guardar datos del recibo"}
          </button>
        </div>
        <div className="hint" style={{ marginTop: 12 }}>
          Por defecto se emite un <strong>“Recibo” sin desglose de IVA</strong> (justificante de pago, válido para que el socio tenga
          constancia). Para que sirva como <strong>factura</strong> deducible (IVA, numeración, NIF del cliente…) confírmalo con tu
          gestor y cambia aquí el tipo de documento y el IVA. El recibo incluye el DNI/NIF del socio si lo tienes guardado en su ficha.
        </div>
      </div>
    </div>
  );
}
