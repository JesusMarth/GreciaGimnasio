import type { ConfigEmail, CopiaInfo, DatosRecibo, Dashboard, Metricas, Pago, Socio, Tarifa } from "./types.ts";

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const r = await fetch("/api" + path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!r.ok) {
    let msg = r.statusText;
    try {
      const j = await r.json();
      msg = j.error || msg;
    } catch {
      /* sin cuerpo JSON */
    }
    throw new Error(msg);
  }
  if (r.status === 204) return undefined as T;
  return r.json() as Promise<T>;
}

const body = (data: unknown) => JSON.stringify(data);

export const api = {
  dashboard: () => req<Dashboard>("/dashboard"),

  metricas: (p?: { desde?: string; hasta?: string; meses?: number; actividad?: string }) => {
    const q = new URLSearchParams();
    if (p?.desde && p?.hasta) {
      q.set("desde", p.desde);
      q.set("hasta", p.hasta);
    } else if (p?.meses) {
      q.set("meses", String(p.meses));
    }
    if (p?.actividad && p.actividad !== "todas") q.set("actividad", p.actividad);
    const s = q.toString();
    return req<Metricas>("/metricas" + (s ? `?${s}` : ""));
  },

  socios: (buscar?: string) =>
    req<Socio[]>("/socios" + (buscar ? `?buscar=${encodeURIComponent(buscar)}` : "")),
  socio: (id: number) => req<Socio>(`/socios/${id}`),
  crearSocio: (data: Record<string, unknown>) => req<Socio>("/socios", { method: "POST", body: body(data) }),
  editarSocio: (id: number, data: Record<string, unknown>) =>
    req<Socio>(`/socios/${id}`, { method: "PUT", body: body(data) }),
  borrarSocio: (id: number) => req<{ ok: true }>(`/socios/${id}`, { method: "DELETE" }),

  crearSuscripcion: (socioId: number, data: Record<string, unknown>) =>
    req(`/socios/${socioId}/suscripciones`, { method: "POST", body: body(data) }),
  editarSuscripcion: (id: number, data: Record<string, unknown>) =>
    req(`/suscripciones/${id}`, { method: "PUT", body: body(data) }),
  borrarSuscripcion: (id: number) => req(`/suscripciones/${id}`, { method: "DELETE" }),

  registrarPago: (data: Record<string, unknown>) =>
    req<{ id: number; total: number }>("/pagos", { method: "POST", body: body(data) }),
  pagosDeSocio: (id: number) => req<Pago[]>(`/pagos/de-socio/${id}`),
  borrarPago: (id: number) => req(`/pagos/${id}`, { method: "DELETE" }),

  tarifas: () => req<Tarifa[]>("/tarifas"),
  crearTarifa: (data: Record<string, unknown>) => req<Tarifa>("/tarifas", { method: "POST", body: body(data) }),
  editarTarifa: (id: number, data: Record<string, unknown>) =>
    req<Tarifa>(`/tarifas/${id}`, { method: "PUT", body: body(data) }),
  borrarTarifa: (id: number) => req(`/tarifas/${id}`, { method: "DELETE" }),

  backups: () => req<{ dbPath: string; carpeta: string; copias: CopiaInfo[] }>("/backups"),
  hacerCopia: () => req<CopiaInfo>("/backup", { method: "POST" }),
  restaurarCopia: (archivo: string) => req("/backup/restaurar", { method: "POST", body: body({ archivo }) }),

  configEmail: () => req<ConfigEmail>("/config/email"),
  guardarConfigEmail: (data: Record<string, unknown>) => req("/config/email", { method: "POST", body: body(data) }),
  probarEmail: () => req<{ ok: true }>("/config/email/probar", { method: "POST" }),
  avisarEmail: (socioId: number) => req<{ ok: true; email: string }>("/avisos/email", { method: "POST", body: body({ socioId }) }),

  datosRecibo: () => req<DatosRecibo>("/config/datos"),
  guardarDatosRecibo: (data: Record<string, unknown>) => req("/config/datos", { method: "POST", body: body(data) }),
  enviarRecibo: (pagoId: number) => req<{ ok: true; email: string }>(`/pagos/${pagoId}/recibo/email`, { method: "POST" }),
  // URL directa al PDF (para abrir/descargar en el navegador, no es fetch).
  reciboUrl: (pagoId: number, descargar = false) => `/api/pagos/${pagoId}/recibo.pdf${descargar ? "?dl=1" : ""}`,

  // URLs de exportación a Excel (el servidor las sirve como descarga .xlsx).
  exportSociosUrl: (ids?: number[]) => `/api/export/socios${ids && ids.length ? `?ids=${ids.join(",")}` : ""}`,
  exportSocioUrl: (id: number) => `/api/export/socio/${id}`,
};

export const ACTIVIDADES = ["gimnasio", "karate", "pilates"];
export const METODOS = ["efectivo", "transferencia", "bizum", "tarjeta"];
