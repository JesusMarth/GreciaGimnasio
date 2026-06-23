import { NavLink, Route, Routes } from "react-router-dom";
import { Panel } from "./pages/Panel.tsx";
import { Socios } from "./pages/Socios.tsx";
import { SocioDetalle } from "./pages/SocioDetalle.tsx";
import { Tarifas } from "./pages/Tarifas.tsx";

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo">G</div>
        <div className="name">
          GymGrecia
          <small>Gestión de socios</small>
        </div>
      </div>
      <NavLink to="/" end className="nav-link">
        <span className="ico">▣</span> Panel
      </NavLink>
      <NavLink to="/socios" className="nav-link">
        <span className="ico">☺</span> Socios
      </NavLink>
      <NavLink to="/tarifas" className="nav-link">
        <span className="ico">€</span> Tarifas
      </NavLink>
      <div className="spacer" />
      <div className="foot">Datos guardados en este equipo.</div>
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
        </Routes>
      </main>
    </div>
  );
}
