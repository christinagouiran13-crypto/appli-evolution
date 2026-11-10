import { useEffect, useMemo } from "react";
import type { ReactNode } from "react";

const COLORS = ["#2F5D50", "#F2C4BD", "#BFE0D5", "#E3A39B", "#1E3A32", "#F0DDA0"];

// Petite fête à l'envoi d'un check-in ou d'un débrief
export function Celebration({ title, children, onClose }: { title: string; children?: ReactNode; onClose: () => void }) {
  const pieces = useMemo(() => Array.from({ length: 36 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.6,
    color: COLORS[i % COLORS.length],
    rot: Math.random() * 360,
  })), []);
  useEffect(() => {
    navigator.vibrate?.(30);
  }, []);
  return (
    <div className="celebrate" role="dialog" aria-modal="true" aria-label={title}>
      {pieces.map((p, i) => (
        <span key={i} className="confetti" style={{ left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}s`, transform: `rotate(${p.rot}deg)` }} />
      ))}
      <div className="celebrate-card">
        <svg width="72" height="52" viewBox="0 0 88 64" aria-hidden="true">
          <path d="M8 54 Q44 -6 80 54" fill="none" stroke="#2F5D50" strokeWidth="5" strokeLinecap="round" />
          <circle cx="44" cy="12" r="6" fill="#E3A39B" />
          <rect x="30" y="49" width="28" height="6" rx="3" fill="#1E3A32" />
        </svg>
        <div className="serif" style={{ fontSize: 26, fontWeight: 500, lineHeight: 1.15 }}>{title}</div>
        {children}
        <button className="btn" onClick={onClose}>Continuer</button>
      </div>
    </div>
  );
}
