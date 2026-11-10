import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useMe } from "../../lib/auth";
import { addDays, currentWeek, fmtShort } from "../../lib/dates";
import type { GoalItem, WeeklyGoals } from "../../lib/types";
import { BackHeader } from "../../components/BackHeader";
import { Icon } from "../../components/Icon";

function GoalList({ items, onChange, placeholder, readOnly }: {
  items: GoalItem[]; onChange: (v: GoalItem[]) => void; placeholder: string; readOnly?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    if (!draft.trim()) return;
    onChange([...items, { text: draft.trim(), done: false }]);
    setDraft("");
  };
  return (
    <div className="stack-sm">
      {items.map((it, i) => (
        <div key={i} className="card row" style={{ padding: "8px 12px" }}>
          <label className="check grow" style={{ alignItems: "center" }}>
            <input type="checkbox" checked={it.done} disabled={readOnly}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)))} />
            <span style={{ textDecoration: it.done ? "line-through" : undefined, color: it.done ? "var(--texte-doux)" : undefined }}>{it.text}</span>
          </label>
          {!readOnly && (
            <button className="icon-btn" style={{ border: "none" }} aria-label={`Retirer « ${it.text} »`} onClick={() => onChange(items.filter((_, j) => j !== i))}>
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
      ))}
      {!readOnly && (
        <div className="row">
          <input className="input grow" placeholder={placeholder} value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} aria-label={placeholder} />
          <button className="icon-btn solid" aria-label="Ajouter" onClick={add}><Icon name="plus" size={18} /></button>
        </div>
      )}
    </div>
  );
}

export default function Goals() {
  const { me } = useMe();
  const [week, setWeek] = useState(currentWeek());
  const [g, setG] = useState<Pick<WeeklyGoals, "goals" | "process_goals" | "takeaway">>({ goals: [], process_goals: [], takeaway: "" });
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [loaded, setLoaded] = useState(false);
  const readOnly = me.status !== "active";
  const isCurrent = week === currentWeek();

  useEffect(() => {
    setLoaded(false);
    supabase.from("weekly_goals").select("*").eq("rider_id", me.id).eq("week_start", week).maybeSingle().then(({ data }) => {
      setG(data ? { goals: data.goals, process_goals: data.process_goals, takeaway: data.takeaway ?? "" } : { goals: [], process_goals: [], takeaway: "" });
      setLoaded(true);
    });
  }, [me.id, week]);

  async function save(next: typeof g) {
    setG(next);
    if (readOnly) return;
    setSaved("saving");
    const { error } = await supabase.from("weekly_goals").upsert(
      { rider_id: me.id, week_start: week, ...next, updated_at: new Date().toISOString() },
      { onConflict: "rider_id,week_start" },
    );
    setSaved(error ? "error" : "saved");
  }

  return (
    <div className="page">
      <BackHeader label={isCurrent ? "Cette semaine" : `Semaine du ${fmtShort(week)}`} />
      <div className="stack-sm">
        <h1 className="h1">Mes objectifs de la semaine</h1>
        {me.season_goal && <p className="muted" style={{ margin: 0 }}>Objectif de saison : <b>{me.season_goal}</b></p>}
      </div>
      <div className="row-between">
        <button className="btn btn-light btn-sm" onClick={() => setWeek(addDays(week, -7))}>← Semaine précédente</button>
        {!isCurrent && <button className="btn btn-light btn-sm" onClick={() => setWeek(addDays(week, 7))}>Suivante →</button>}
      </div>
      {loaded && (
        <>
          <section className="stack">
            <div className="stack-sm">
              <h2 className="h2">Mes objectifs</h2>
              <div className="hint">Ce que tu veux réussir cette semaine, à cheval ou en concours.</div>
            </div>
            <GoalList items={g.goals} readOnly={readOnly} placeholder="Ex. : enchaîner le parcours sans m'arrêter"
              onChange={(goals) => save({ ...g, goals })} />
          </section>
          <section className="stack">
            <div className="stack-sm">
              <h2 className="h2">Mes objectifs de processus</h2>
              <div className="hint">Ce que tu contrôles : respiration, regard, routine…</div>
            </div>
            <GoalList items={g.process_goals} readOnly={readOnly} placeholder="Ex. : 3 respirations avant d'entrer en piste"
              onChange={(process_goals) => save({ ...g, process_goals })} />
          </section>
          <section className="field">
            <label htmlFor="take">En fin de semaine : ce que je retiens</label>
            <textarea id="take" className="textarea" disabled={readOnly} value={g.takeaway ?? ""}
              placeholder="Coche ce qui est atteint, puis note ce que tu retiens."
              onChange={(e) => setG({ ...g, takeaway: e.target.value })} onBlur={() => save(g)} />
          </section>
          <div className="hint" aria-live="polite">
            {saved === "saving" && "Enregistrement…"}
            {saved === "saved" && "Enregistré. Christina voit tes objectifs dans ta fiche."}
            {saved === "error" && "Pas enregistré : vérifie ta connexion."}
          </div>
        </>
      )}
    </div>
  );
}
