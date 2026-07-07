import { NavLink, Route, Routes } from "react-router-dom";
import { Panel } from "./pages/Panel.tsx";
import { Metricas } from "./pages/Metricas.tsx";
import { Socios } from "./pages/Socios.tsx";
import { SocioDetalle } from "./pages/SocioDetalle.tsx";
import { Tarifas } from "./pages/Tarifas.tsx";
import { Copias } from "./pages/Copias.tsx";
import { Ajustes } from "./pages/Ajustes.tsx";

/** Glifo de templo griego depurado a geometría sólida (frontón + columnas +
 *  basamento). Construido solo con formas básicas para escalar nítido en
 *  pantalla, favicon y recibos. */
export function TemploGlifo() {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden="true">
      <path d="M24 5 L43 17 H5 Z" />
      <rect x="5" y="19.4" width="38" height="3.2" />
      <rect x="9" y="24.6" width="3.1" height="13.6" />
      <rect x="15.7" y="24.6" width="3.1" height="13.6" />
      <rect x="22.45" y="24.6" width="3.1" height="13.6" />
      <rect x="29.2" y="24.6" width="3.1" height="13.6" />
      <rect x="35.9" y="24.6" width="3.1" height="13.6" />
      <rect x="5" y="40" width="38" height="3.2" />
      <rect x="2.5" y="44.4" width="43" height="2.2" opacity="0.45" />
    </svg>
  );
}

/** Iconos del panel lateral (líneas, estilo de plano). */
const ICONOS: Record<string, JSX.Element> = {
  panel: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
    </svg>
  ),
  socios: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="12" r="5.3" />
      <circle cx="15" cy="12" r="5.3" />
    </svg>
  ),
  metricas: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <rect x="7" y="12" width="3" height="6" rx="0.6" />
      <rect x="12" y="8" width="3" height="10" rx="0.6" />
      <rect x="17" y="5" width="3" height="13" rx="0.6" />
    </svg>
  ),
  tarifas: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.6 13.1 L13 20.7 a2 2 0 0 1 -2.8 0 L3.6 14 a2 2 0 0 1 -0.6 -1.4 V5.5 a1.5 1.5 0 0 1 1.5 -1.5 h7 a2 2 0 0 1 1.4 0.6 l7.3 7.3 a2 2 0 0 1 0 2.2 Z" />
      <circle cx="8" cy="8.6" r="1.5" />
    </svg>
  ),
  copias: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8.5" y="8.5" width="12" height="12" rx="2" />
      <path d="M4.5 15.5 A1.5 1.5 0 0 1 3 14 V5 A1.5 1.5 0 0 1 4.5 3.5 h9 A1.5 1.5 0 0 1 15 5" />
    </svg>
  ),
  ajustes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
      <path d="M12 2.4 V5 M12 19 V21.6 M2.4 12 H5 M19 12 H21.6 M5.2 5.2 L7 7 M19 19 L17.2 17.2 M18.8 5.2 L17 7 M5 19 L6.8 17.2" />
    </svg>
  ),
};

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo">
          <TemploGlifo />
        </div>
        <div className="name">
          GymGrecia
          <small>Gestión de socios</small>
        </div>
      </div>
      <NavLink to="/" end className="nav-link">
        <span className="ico">{ICONOS.panel}</span> Panel
      </NavLink>
      <NavLink to="/socios" className="nav-link">
        <span className="ico">{ICONOS.socios}</span> Socios
      </NavLink>
      <NavLink to="/metricas" className="nav-link">
        <span className="ico">{ICONOS.metricas}</span> Métricas
      </NavLink>
      <NavLink to="/tarifas" className="nav-link">
        <span className="ico">{ICONOS.tarifas}</span> Tarifas
      </NavLink>
      <NavLink to="/copias" className="nav-link">
        <span className="ico">{ICONOS.copias}</span> Copias
      </NavLink>
      <NavLink to="/ajustes" className="nav-link">
        <span className="ico">{ICONOS.ajustes}</span> Ajustes
      </NavLink>
      <div className="spacer" />
      <div className="foot">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M5 21h14M7 21V8M17 21V8M4 8h16l-2-4H6L4 8Z" />
        </svg>
        Datos guardados en este equipo.
      </div>
      <div className="foot-version" title="Versión instalada">v{__APP_VERSION__}</div>
    </aside>
  );
}

export function App() {
  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <Routes>
          <Route path="/" element={<Panel />} />
          <Route path="/metricas" element={<Metricas />} />
          <Route path="/socios" element={<Socios />} />
          <Route path="/socios/:id" element={<SocioDetalle />} />
          <Route path="/tarifas" element={<Tarifas />} />
          <Route path="/copias" element={<Copias />} />
          <Route path="/ajustes" element={<Ajustes />} />
        </Routes>
      </main>
    </div>
  );
}
