import type { Dashboard, Pago, Socio, Tarifa } from "./types.ts";

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
};

export const ACTIVIDADES = ["gimnasio", "karate", "pilates"];
export const METODOS = ["efectivo", "transferencia", "bizum", "tarjeta"];
