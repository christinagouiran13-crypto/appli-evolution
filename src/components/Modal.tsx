import type { ReactNode } from "react";
import { Icon } from "./Icon";

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <h2 className="serif" style={{ fontSize: 22, fontWeight: 500 }}>{title}</h2>
          <button className="icon-btn" aria-label="Fermer" onClick={onClose}><Icon name="close" size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
