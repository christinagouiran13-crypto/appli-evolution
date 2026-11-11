import { NavLink, Outlet } from "react-router-dom";
import logo from "../../components/logo-vert.svg";

export default function CoachLayout() {
  const links = [
    { to: "/coach", label: "Tableau de bord", end: true },
    { to: "/coach/messages", label: "Messages" },
    { to: "/coach/inviter", label: "Inviter une cliente" },
    { to: "/coach/indispensables", label: "Indispensables" },
    { to: "/coach/messages-auto", label: "Messages automatiques" },
    { to: "/coach/reglages", label: "Réglages" },
  ];
  return (
    <div className="coach">
      <nav className="coach-nav" aria-label="Espace coach">
        <div className="coach-nav-inner">
          <img src={logo} alt="Évolution" width={34} height={25} style={{ marginRight: 6 }} />
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? "active" : "")}>{l.label}</NavLink>
          ))}
        </div>
      </nav>
      <main className="coach-main"><Outlet /></main>
    </div>
  );
}
