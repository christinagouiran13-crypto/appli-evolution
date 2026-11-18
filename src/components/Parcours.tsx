import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import type { Program } from "../lib/types";
import { Icon } from "./Icon";
import { addDays, programProgress, todayISO } from "../lib/dates";

type Offer = { title: string; tagline: string; description: string };
const ORDER: Program[] = ["starter90", "levelup180", "club"];

// « Ton parcours Évolution » : programme en cours puis les suites possibles
export function Parcours({ progressLabel }: { progressLabel?: string }) {
  const { profile, settings } = useAuth();
  const [sent, setSent] = useState<string | null>(null);
  const offers = settings?.offers as Record<string, Offer> | undefined;
  // Pas encore de suite pour les juniors
  if (!profile || !offers || profile.is_junior) return null;
  const finished = profile.status === "alumni";
  // « Ça m'intéresse » seulement à la fin du programme (2 dernières semaines) ou après
  const end = programProgress(profile, settings)?.end;
  const canAsk = finished || profile.program === "club" || (!!end && todayISO() >= addDays(end, -14));
  const idx = profile.program ? ORDER.indexOf(profile.program) : -1;

  async function interest(p: Program) {
    const { error } = await supabase.rpc("express_interest", { prog: p });
    if (!error) setSent(p);
  }

  return (
    <section className="stack">
      <h2 className="h2">Ton parcours Évolution</h2>
      <ol className="parcours">
        {ORDER.map((p, i) => {
          const o = offers[p];
          if (!o) return null;
          const state = i < idx || (i === idx && finished) ? "done" : i === idx ? "current" : "next";
          return (
            <li key={p} className={`parcours-step ${state}`}>
              <span className="parcours-dot" aria-hidden="true">{state === "done" ? <Icon name="check" size={14} stroke={2.5} /> : i + 1}</span>
              <div className={state === "current" ? "card-soft stack-sm" : "card stack-sm"} style={{ flex: 1 }}>
                <div className="row-between wrap">
                  <div className="h3">{o.title}</div>
                  {state === "current" && <span className="tag tag-vert">Ton programme</span>}
                  {state === "done" && <span className="tag tag-gris">Terminé</span>}
                  {state === "next" && <span className="tag tag-rose">{i === idx + 1 || (finished && i === idx + 1) ? "La suite" : "Et après"}</span>}
                </div>
                <div className="small bold" style={{ color: "var(--vert)" }}>{o.tagline}</div>
                <div className="small">{o.description}</div>
                {state === "current" && progressLabel && <div className="small muted">{progressLabel}</div>}
                {state === "next" && !canAsk && (
                  <div className="small muted">Disponible à la fin de ton {offers[ORDER[idx]]?.title ?? "programme"}. Tu pourras en parler avec Christina.</div>
                )}
                {state === "next" && canAsk && (sent === p ? (
                  <div className="success small">Message envoyé à Christina, elle te répond très vite !</div>
                ) : (
                  <button className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => interest(p)}>
                    <Icon name="star" size={16} />Ça m'intéresse
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
