import { useEffect, useState } from "react";
import { api } from "../api.ts";
import { AyudaAjustes } from "../components/Ayuda.tsx";
import { Desplegable } from "../components/Desplegable.tsx";
import type { ConfigCopias } from "../types.ts";

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

  // --- Copia de seguridad por email ---
  const [copias, setCopias] = useState<ConfigCopias | null>(null);
  const [copiasEmail, setCopiasEmail] = useState("");
  const [copiasActivo, setCopiasActivo] = useState(true);
  const [guardandoC, setGuardandoC] = useState(false);
  const [enviandoC, setEnviandoC] = useState(false);

  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [guardandoD, setGuardandoD] = useState(false);

  function cargarCopias() {
    api
      .configCopias()
      .then((c) => {
        setCopias(c);
        setCopiasEmail(c.email);
        setCopiasActivo(c.activo);
      })
      .catch(() => {});
  }

  async function guardarCopias() {
    setGuardandoC(true);
    setError("");
    setAviso("");
    try {
      await api.guardarConfigCopias({ email: copiasEmail, activo: copiasActivo });
      setAviso("Copia por email guardada.");
      cargarCopias();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGuardandoC(false);
    }
  }

  async function enviarCopiaAhora() {
    setEnviandoC(true);
    setError("");
    setAviso("");
    try {
      await api.guardarConfigCopias({ email: copiasEmail, activo: copiasActivo });
      const r = await api.enviarCopiaEmail();
      setAviso(`Copia enviada a ${r.para} (${Math.round((r.bytes ?? 0) / 1024)} KB). Revisa el buzón.`);
      cargarCopias();
    } catch (e: any) {
      setError(e.message);
      cargarCopias();
    } finally {
      setEnviandoC(false);
    }
  }

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
    cargarCopias();
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
              <Desplegable
                value={secure ? "ssl" : "starttls"}
                onChange={(v) => setSecure(v === "ssl")}
                opciones={[
                  { value: "ssl", label: "SSL (465)" },
                  { value: "starttls", label: "STARTTLS (587)" },
                ]}
              />
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
            <Desplegable
              value={tipoDoc}
              onChange={setTipoDoc}
              opciones={[
                { value: "Recibo", label: "Recibo" },
                { value: "Factura", label: "Factura" },
              ]}
            />
          </div>
          <div className="field">
            <label>IVA</label>
            <Desplegable
              value={iva}
              onChange={setIva}
              opciones={[
                { value: "no", label: "No desglosar (recibo simple)" },
                { value: "incluido", label: "Incluido en el precio" },
                { value: "exento", label: "Exento" },
              ]}
            />
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

      <div className="card card-pad" style={{ marginTop: 18 }}>
        <div className="section-title">Copia de seguridad por email (fuera del PC)</div>
        <p style={{ marginTop: 0, lineHeight: 1.6 }}>
          Cada día, <strong>al cerrar la app</strong>, se envía la base de datos entera adjunta a este correo (y si ese envío no
          pudo hacerse, se reintenta al abrirla). Así, si el ordenador se rompe, los datos están a salvo en el buzón: se descarga
          el adjunto más reciente y se restaura desde <strong>Copias</strong>. Necesita el correo de envío configurado arriba.
        </p>
        <div className="row2">
          <div className="field">
            <label>Correo que recibe las copias</label>
            <input value={copiasEmail} onChange={(e) => setCopiasEmail(e.target.value)} placeholder="gimnasio@gmail.com" />
          </div>
          <div className="field">
            <label>Envío automático</label>
            <label style={{ textTransform: "none", fontSize: 13.5, fontWeight: 500, color: "var(--tinta)", display: "flex", alignItems: "center", gap: 8, paddingTop: 9 }}>
              <input type="checkbox" checked={copiasActivo} onChange={(e) => setCopiasActivo(e.target.checked)} style={{ width: "auto" }} />
              Enviar la copia al cerrar la app (cada día)
            </label>
          </div>
        </div>
        {copias && <EstadoCopiaEmail c={copias} />}
        <div className="btn-row" style={{ marginTop: 6 }}>
          <button className="btn primary" onClick={guardarCopias} disabled={guardandoC}>
            {guardandoC ? "Guardando…" : "Guardar"}
          </button>
          <button className="btn" onClick={enviarCopiaAhora} disabled={enviandoC || !copias?.correoConfigurado} title={copias?.correoConfigurado ? "Envía ahora mismo una copia (sirve para comprobar que llega)" : "Configura y guarda primero el correo de envío"}>
            {enviandoC ? "Enviando…" : "Enviar copia ahora"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Estado del último envío de la copia por email (compartido con la pantalla Copias). */
export function EstadoCopiaEmail({ c }: { c: ConfigCopias }) {
  const fecha = (s: string) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)} a las ${s.slice(11)}` : "");
  const MOTIVO: Record<string, string> = { cierre: "al cerrar la app", arranque: "al abrir la app", diario: "revisión diaria", manual: "a mano" };
  if (!c.correoConfigurado)
    return <div className="aviso-banner">Falta configurar el correo de envío (Ajustes → Correo de envío). Hasta entonces no se puede enviar ninguna copia.</div>;
  if (!c.activo && !c.ultimoEnvio) return <div className="aviso-banner">El envío automático está apagado y nunca se ha enviado una copia.</div>;
  return (
    <>
      {c.ultimoEnvio ? (
        <div className="hint" style={{ marginBottom: 8 }}>
          ✓ Última copia enviada el <strong>{fecha(c.ultimoEnvio)}</strong> ({MOTIVO[c.ultimoMotivo] ?? c.ultimoMotivo}) a {c.email}.
        </div>
      ) : (
        <div className="hint" style={{ marginBottom: 8 }}>Todavía no se ha enviado ninguna copia. Se enviará al cerrar la app, o pulsa «Enviar copia ahora».</div>
      )}
      {c.ultimoError && (
        <div className="aviso-banner">
          ⚠ El último intento ({fecha(c.ultimoIntento)}) falló: {c.ultimoError}
        </div>
      )}
      {!c.activo && c.ultimoEnvio && <div className="aviso-banner">El envío automático está apagado: solo se enviará cuando pulses «Enviar copia ahora».</div>}
    </>
  );
}
