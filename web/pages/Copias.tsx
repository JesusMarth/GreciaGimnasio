import { useEffect, useState } from "react";
import { api } from "../api.ts";
import { useConfirm } from "../components/Confirmar.tsx";
import { AyudaCopias } from "../components/Ayuda.tsx";
import type { CopiaInfo } from "../types.ts";

function tam(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function cuando(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });
}

const TIPO_LABEL: Record<string, string> = {
  auto: "Automática",
  manual: "Manual",
  "pre-restore": "Antes de restaurar",
};

export function Copias() {
  const [copias, setCopias] = useState<CopiaInfo[]>([]);
  const [rutas, setRutas] = useState<{ dbPath: string; carpeta: string } | null>(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const confirmar = useConfirm();

  function recargar() {
    api
      .backups()
      .then((d) => {
        setRutas({ dbPath: d.dbPath, carpeta: d.carpeta });
        setCopias(d.copias);
      })
      .catch((e) => setError(e.message));
  }
  useEffect(recargar, []);

  async function hacer() {
    setTrabajando(true);
    setError("");
    setAviso("");
    try {
      await api.hacerCopia();
      setAviso("Copia creada correctamente.");
      recargar();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setTrabajando(false);
    }
  }

  async function restaurar(c: CopiaInfo) {
    const ok = await confirmar({
      titulo: "Restaurar copia",
      mensaje: `Esto reemplazará TODOS los datos actuales por los de la copia del ${cuando(c.creado)}. Antes se guardará automáticamente una copia de lo que tienes ahora. ¿Continuar?`,
      confirmar: "Restaurar",
      peligro: true,
    });
    if (!ok) return;
    setTrabajando(true);
    setError("");
    try {
      await api.restaurarCopia(c.archivo);
      // La base entera ha cambiado: recargamos la app para refrescar todas las vistas.
      window.location.reload();
    } catch (e: any) {
      setError(e.message);
      setTrabajando(false);
    }
  }

  return (
    <div className="lienzo">
      <div className="page-head">
        <div>
          <div className="eyebrow">Resguardo</div>
          <h1>Copias de seguridad</h1>
          <div className="sub">Protege los datos del gimnasio y llévatelos a otro equipo.</div>
        </div>
        <div className="btn-row">
          <button className="btn primary" onClick={hacer} disabled={trabajando}>
            {trabajando ? "Trabajando…" : "Hacer copia ahora"}
          </button>
          <AyudaCopias />
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {aviso && <div className="ok-banner">{aviso}</div>}

      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <div className="section-title">Llevar los datos a otro PC</div>
        <p style={{ marginTop: 0, lineHeight: 1.6 }}>
          Todos los datos viven en un único archivo. Para pasar <strong>TODO</strong> a otro ordenador, copia la carpeta{" "}
          <strong>data</strong> entera (incluye la base y estas copias) y ponla en el mismo sitio del otro equipo.
        </p>
        {rutas && (
          <>
            <div className="kv">
              <span className="k">Base de datos</span>
              <span style={{ wordBreak: "break-all" }}>{rutas.dbPath}</span>
            </div>
            <div className="kv" style={{ borderBottom: "none" }}>
              <span className="k">Copias</span>
              <span style={{ wordBreak: "break-all" }}>{rutas.carpeta}</span>
            </div>
          </>
        )}
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        {copias.length === 0 ? (
          <div className="center-box">Aún no hay copias. Pulsa “Hacer copia ahora”.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Tamaño</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {copias.map((c) => (
                <tr key={c.archivo}>
                  <td className="nombre">{cuando(c.creado)}</td>
                  <td>
                    <span className="pill-act">{TIPO_LABEL[c.tipo] ?? c.tipo}</span>
                  </td>
                  <td className="muted">{tam(c.bytes)}</td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn sm" onClick={() => restaurar(c)} disabled={trabajando}>
                      Restaurar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="hint" style={{ marginTop: 12 }}>
        Se hace una copia automática al abrir y al cerrar la app. De las automáticas se conservan las 14 más recientes; las
        manuales y las previas a una restauración se conservan todas.
      </div>
    </div>
  );
}
