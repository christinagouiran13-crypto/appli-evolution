import { NavLink } from "react-router-dom";
import { Icon } from "./Icon";

const TABS = [
  { to: "/", label: "Accueil", icon: "home", end: true },
  { to: "/checkin", label: "Check-in", icon: "pulse" },
  { to: "/concours", label: "Concours", icon: "flag" },
  { to: "/indispensables", label: "Indispensables", icon: "heart" },
  { to: "/messages", label: "Messages", icon: "chat" },
];

export function TabBar({ unread = 0 }: { unread?: number }) {
  return (
    <nav className="tabbar" aria-label="Navigation principale">
      <div className="tabbar-inner">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => "tab" + (isActive ? " active" : "")}>
            <Icon name={t.icon} />
            {t.label}
            {t.to === "/messages" && unread > 0 && <span className="dot" aria-label={`${unread} nouveaux messages`} />}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
