import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useMe } from "../../lib/auth";
import type { Phase, Routine as R, RoutineAudio } from "../../lib/types";
import { SignedAudio } from "../../components/Media";
import { Celebration } from "../../components/Celebration";
import { Icon } from "../../components/Icon";
import { BackHeader } from "../../components/BackHeader";
import { newId } from "../../lib/storage";

export const PHASES: { key: Phase; label: string }[] = [
  { key: "avant", label: "Avant" },
  { key: "pendant", label: "Pendant" },
  { key: "apres", label: "Après" },
];

export default function Routine() {
  const { me, refresh } = useMe();
  const [r, setR] = useState<R | null>(null);
  const [audios, setAudios] = useState<RoutineAudio[]>([]);
  const [phase, setPhase] = useState<Phase>("avant");
  const [celebrate, setCelebrate] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const readOnly = me.status !== "active";

  useEffect(() => {
    refresh(); // mot d'ancrage à jour
    supabase.from("routines").select("*").eq("rider_id", me.id).maybeSingle().then(({ data }) => setR(data as R));
    supabase.from("routine_audios").select("*").eq("rider_id", me.id).order("created_at").then(({ data }) => setAudios((data as RoutineAudio[]) ?? []));
  }, [me.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!r) return <div className="loading">Chargement…</div>;
  const all = PHASES.flatMap((p) => r.steps[p.key] ?? []);
  const steps = r.steps[phase] ?? [];

  async function toggle(id: string) {
    if (readOnly || !r) return;
    const checked = r.checked.includes(id) ? r.checked.filter((x) => x !== id) : [...r.checked, id];
    setR({ ...r, checked });
    await supabase.from("routines").update({ checked }).eq("rider_id", me.id);
    if (all.length > 0 && all.every((s) => checked.includes(s.id)) && !r.checked.includes(id)) setCelebrate(true);
  }

  async function reset() {
    if (!r) return;
    setR({ ...r, checked: [] });
    await supabase.from("routines").update({ checked: [] }).eq("rider_id", me.id);
  }

  const done = steps.filter((s) => r.checked.includes(s.id)).length;

  async function saveSteps(next: R["steps"]) {
    if (!r) return;
    setR({ ...r, steps: next });
    await supabase.from("routines").update({ steps: next }).eq("rider_id", me.id);
  }
  const addStep = () => {
    if (!draft.trim() || !r) return;
    saveSteps({ ...r.steps, [phase]: [...steps, { id: newId(), text: draft.trim() }] });
    setDraft("");
  };
  const delStep = (id: string) => r && saveSteps({ ...r.steps, [phase]: steps.filter((x) => x.id !== id) });
  const editStep = (id: string, text: string) => r && setR({ ...r, steps: { ...r.steps, [phase]: steps.map((x) => (x.id === id ? { ...x, text } : x)) } });
  const moveStep = (i: number, d: number) => {
    if (!r) return;
    const a = [...steps]; const j = i + d;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    saveSteps({ ...r.steps, [phase]: a });
  };

  return (
    <div className="page">
      <BackHeader to="/indispensables" label="Mes indispensables" />
      <div className="stack-sm">
        <h1 className="h1">Ma routine</h1>
        <p className="muted" style={{ margin: 0 }}>Construis-la avec Christina, puis coche chaque étape le jour du concours.</p>
      </div>
      {!readOnly && (
        <button className={`btn btn-sm ${editing ? "" : "btn-light"}`} style={{ alignSelf: "flex-start" }} onClick={() => setEditing(!editing)}>
          <Icon name={editing ? "check" : "edit"} size={16} />{editing ? "J'ai fini de modifier" : "Modifier ma routine"}
        </button>
      )}

      {me.anchor_word && (
        <div className="card-soft stack-sm center">
          <div className="eyebrow">Mon mot d'ancrage</div>
          <div className="serif" style={{ fontSize: 30, fontWeight: 500 }}>{me.anchor_word}</div>
        </div>
      )}

      <div className="segmented" role="group" aria-label="Moment de la routine">
        {PHASES.map((p) => (
          <button key={p.key} aria-pressed={phase === p.key} onClick={() => setPhase(p.key)}>{p.label}</button>
        ))}
      </div>

      {editing ? (
        <div className="stack-sm">
          {steps.map((s, i) => (
            <div key={s.id} className="row" style={{ gap: 4 }}>
              <input className="input grow" aria-label={`Étape ${i + 1}`} value={s.text} onChange={(e) => editStep(s.id, e.target.value)} onBlur={() => r && saveSteps(r.steps)} />
              <button className="icon-btn" style={{ width: 38, height: 38 }} aria-label="Monter l'étape" onClick={() => moveStep(i, -1)}>↑</button>
              <button className="icon-btn" style={{ width: 38, height: 38 }} aria-label="Supprimer l'étape" onClick={() => delStep(s.id)}><Icon name="close" size={14} /></button>
            </div>
          ))}
          <div className="row">
            <input className="input grow" aria-label="Nouvelle étape" placeholder="Nouvelle étape (ex. : 3 respirations au paddock)" value={draft}
              onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addStep())} />
            <button className="icon-btn solid" aria-label="Ajouter l'étape" onClick={addStep}><Icon name="plus" size={18} /></button>
          </div>
        </div>
      ) : steps.length === 0 ? (
        <div className="empty">Pas encore d'étape ici. Touche « Modifier ma routine » pour la construire, ou prépare-la avec Christina en séance.</div>
      ) : (
        <div className="stack-sm">
          <div className="small muted">{done} sur {steps.length} étapes</div>
          {steps.map((s) => (
            <label key={s.id} className="card check" style={{ alignItems: "center" }}>
              <input type="checkbox" checked={r.checked.includes(s.id)} disabled={readOnly} onChange={() => toggle(s.id)} />
              <span style={{ textDecoration: r.checked.includes(s.id) ? "line-through" : undefined }}>{s.text}</span>
            </label>
          ))}
        </div>
      )}

      {!readOnly && !editing && r.checked.length > 0 && (
        <button className="btn btn-light btn-sm" style={{ alignSelf: "flex-start" }} onClick={reset}>Tout décocher pour le prochain concours</button>
      )}

      {audios.length > 0 && (
        <section className="stack">
          <h2 className="h2">Mes audios de visualisation</h2>
          {audios.map((a) => (
            <div key={a.id} className="card stack-sm">
              <div className="h3">{a.title}</div>
              <SignedAudio bucket="audios" path={a.path} />
            </div>
          ))}
        </section>
      )}

      {celebrate && (
        <Celebration title="Routine au paddock !" onClose={() => setCelebrate(false)}>
          <p style={{ margin: 0 }}>Tu as suivi ta routine en entier. C'est exactement ça, la préparation mentale.</p>
        </Celebration>
      )}
    </div>
  );
}
