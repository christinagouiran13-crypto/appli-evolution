import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { fmtShort, programProgress } from "../lib/dates";
import { BADGES, PROGRAM_LABEL, badgeName } from "../lib/text";
import type { Checkin, Profile, Settings } from "../lib/types";
import { LineChart } from "./LineChart";
import { Icon } from "./Icon";

const METRICS: { key: keyof Checkin; label: string; inverse?: boolean }[] = [
  { key: "confidence", label: "Confiance en moi" },
  { key: "focus", label: "Concentration à cheval" },
  { key: "motivation", label: "Motivation" },
  { key: "stress", label: "Stress", inverse: true },
];

type Stats = { checkins: Checkin[]; debriefs: number; comps: number; sansFaute: number; victories: number; modules: number; badges: string[] };

// Bilan de fin de programme : avant / après, chiffres et badges
export function Bilan({ p, settings }: { p: Profile; settings: Settings | null }) {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => {
    (async () => {
      const [c, d, comp, sf, v, m, b] = await Promise.all([
        supabase.from("checkins").select("*").eq("rider_id", p.id).order("week_start"),
        supabase.from("debriefs").select("id", { count: "exact", head: true }).eq("rider_id", p.id),
        supabase.from("competitions").select("id", { count: "exact", head: true }).eq("rider_id", p.id),
        supabase.from("debriefs").select("id", { count: "exact", head: true }).eq("rider_id", p.id).eq("result", "sans_faute"),
        supabase.from("messages").select("id", { count: "exact", head: true }).is("thread_rider_id", null).eq("kind", "victory").eq("sender_id", p.id),
        supabase.from("training_progress").select("module_id", { count: "exact", head: true }).eq("rider_id", p.id),
        supabase.from("badges").select("code").eq("rider_id", p.id),
      ]);
      setS({
        checkins: (c.data as Checkin[]) ?? [], debriefs: d.count ?? 0, comps: comp.count ?? 0, sansFaute: sf.count ?? 0,
        victories: v.count ?? 0, modules: m.count ?? 0, badges: (b.data ?? []).map((x) => x.code as string),
      });
    })();
  }, [p.id]);

  if (!s) return <div className="loading">Ton bilan se prépare…</div>;
  const first = s.checkins[0];
  const last = s.checkins[s.checkins.length - 1];
  const prog = programProgress(p, settings);
  const name = p.program ? PROGRAM_LABEL[p.program] : "ton accompagnement";

  return (
    <div className="stack-lg">
      <div className="card-soft stack-sm center" style={{ alignItems: "center" }}>
        <div style={{ fontSize: 40 }} aria-hidden="true">🎉</div>
        <div className="serif" style={{ fontSize: 26, fontWeight: 500, lineHeight: 1.2 }}>Bravo {p.first_name} pour ton {name} !</div>
        <div className="small">{prog && p.program_start ? `Depuis le ${fmtShort(p.program_start)}, ` : ""}regarde tout le chemin parcouru.</div>
      </div>

      {first && last && first.id !== last.id ? (
        <section className="stack">
          <h2 className="h2">Avant / après</h2>
          <div className="bilan-grid">
            {METRICS.map((m) => {
              const a = first[m.key] as number, b = last[m.key] as number;
              const better = m.inverse ? b < a : b > a;
              const same = a === b;
              return (
                <div key={m.key} className="card stack-sm">
                  <div className="small muted">{m.label}</div>
                  <div className="row" style={{ gap: 8, alignItems: "baseline" }}>
                    <span className="serif" style={{ fontSize: 26, color: "var(--texte-doux)" }}>{a}</span>
                    <span aria-hidden="true">→</span>
                    <span className="serif" style={{ fontSize: 34, fontWeight: 600, color: same ? "var(--vert-fonce)" : better ? "var(--vert)" : "#B3261E" }}>{b}</span>
                    <span className="small muted">/10</span>
                  </div>
                  {!same && <div className="tiny bold" style={{ color: better ? "var(--vert)" : "var(--texte-doux)" }}>{better ? (m.inverse ? "Stress en baisse" : "En progrès") : "À travailler encore"}</div>}
                </div>
              );
            })}
          </div>
          <div className="card stack">
            <h3 className="h3">Ta courbe, semaine après semaine</h3>
            <LineChart labels={s.checkins.map((c) => fmtShort(c.week_start))} series={[
              { label: "Confiance", color: "#2F5D50", values: s.checkins.map((c) => c.confidence) },
              { label: "Stress", color: "#C0675A", values: s.checkins.map((c) => c.stress), dashed: true },
            ]} />
          </div>
        </section>
      ) : (
        <div className="empty">Ton avant / après apparaîtra dès que tu auras fait au moins deux check-ins.</div>
      )}

      <section className="stack">
        <h2 className="h2">Tes chiffres</h2>
        <div className="bilan-grid">
          <Stat n={s.checkins.length} label="check-ins" />
          <Stat n={s.comps} label="concours notés" />
          <Stat n={s.debriefs} label="débriefs" />
          <Stat n={s.sansFaute} label="sans-faute" />
          <Stat n={s.modules} label="modules de formation" />
          <Stat n={s.victories} label="victoires partagées" />
        </div>
      </section>

      {s.badges.length > 0 && (
        <section className="stack-sm">
          <h2 className="h2">Tes badges</h2>
          <div className="row wrap">
            {BADGES.filter((b) => s.badges.includes(b.code)).map((b) => (
              <span key={b.code} className="tag tag-vert" style={{ fontSize: 14, padding: "6px 12px" }}><Icon name={b.icon} size={14} /> {badgeName(b, p)}</span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="card center stack-sm" style={{ alignItems: "center", padding: "14px 8px" }}>
      <div className="serif" style={{ fontSize: 32, fontWeight: 600, lineHeight: 1 }}>{n}</div>
      <div className="tiny muted">{label}</div>
    </div>
  );
}
