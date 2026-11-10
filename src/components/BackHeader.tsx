import { useNavigate } from "react-router-dom";
import { Icon } from "./Icon";

export function BackHeader({ label, to }: { label?: string; to?: string }) {
  const nav = useNavigate();
  return (
    <div className="row">
      <button className="icon-btn" aria-label="Retour" onClick={() => (to ? nav(to) : nav(-1))}>
        <Icon name="back" size={20} stroke={1.9} />
      </button>
      {label && <div className="muted small">{label}</div>}
    </div>
  );
}
