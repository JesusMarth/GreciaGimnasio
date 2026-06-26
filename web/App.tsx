import { NavLink, Route, Routes } from "react-router-dom";
import { Panel } from "./pages/Panel.tsx";
import { Socios } from "./pages/Socios.tsx";
import { SocioDetalle } from "./pages/SocioDetalle.tsx";
import { Tarifas } from "./pages/Tarifas.tsx";
import { Copias } from "./pages/Copias.tsx";
import { Ajustes } from "./pages/Ajustes.tsx";

/** Glifo de templo griego: frontón + columnas + basamento. */
export function TemploGlifo() {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M24 5 L44 18 L4 18 Z" fill="currentColor" fillOpacity="0.12" />
      <path d="M5 22 H43" />
      <path d="M9 22 V39 M16.5 22 V39 M24 22 V39 M31.5 22 V39 M39 22 V39" strokeWidth="2.1" />
      <path d="M3 39.5 H45" strokeWidth="2.6" />
      <path d="M5 44 H43" strokeWidth="2.4" opacity="0.45" />
    </svg>
  );
}

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
        <span className="ico">▦</span> Panel
      </NavLink>
      <NavLink to="/socios" className="nav-link">
        <span className="ico">☺</span> Socios
      </NavLink>
      <NavLink to="/tarifas" className="nav-link">
        <span className="ico">€</span> Tarifas
      </NavLink>
      <NavLink to="/copias" className="nav-link">
        <span className="ico">▤</span> Copias
      </NavLink>
      <NavLink to="/ajustes" className="nav-link">
        <span className="ico">⚙</span> Ajustes
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
