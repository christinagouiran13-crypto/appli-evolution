import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { TrainingModule } from "../lib/training";

// Espace coach : liens Systemio des modules de formation
export function TrainingAdmin() {
  const [list, setList] = useState<TrainingModule[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(() => {
    supabase.from("training_modules").select("*").order("program").order("position").then(({ data }) => setList((data as TrainingModule[]) ?? []));
  }, []);
  useEffect(load, [load]);
  async function save(m: TrainingModule) {
    const { error } = await supabase.from("training_modules").update({ title: m.title, url: m.url?.trim() || null }).eq("id", m.id);
    setMsg(error ? "Pas enregistré." : `« ${m.title} » enregistré.`);
    setTimeout(() => setMsg(null), 2500);
    load();
  }
  return (
    <section className="card card-lg stack">
      <div className="row-between wrap"><h2 className="h2">Formation Starter 90</h2><span className="tag tag-vert">✓ Déjà en ligne</span></div>
      <div className="hint">
        Tes cavalières Starter 90 voient ces modules dans « Ma formation », avec leur progression. « Ouvrir le module » mène à ta plateforme
        (lien général dans Réglages). Facultatif : colle ici le lien direct d'un module sur Systemio pour qu'il s'ouvre au bon endroit.
      </div>
      {msg && <div className="success">{msg}</div>}
      {list.map((m) => <Row key={m.id} m={m} onSave={save} />)}
    </section>
  );
}

function Row({ m, onSave }: { m: TrainingModule; onSave: (m: TrainingModule) => void }) {
  const [f, setF] = useState(m);
  useEffect(() => setF(m), [m]);
  return (
    <div className="stack-sm" style={{ borderTop: "1px solid var(--bord)", paddingTop: 10 }}>
      <div className="small muted">{m.weeks_label} · {m.lessons.length} leçons</div>
      <input className="input" aria-label="Titre du module" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <div className="row">
        <input className="input grow" aria-label="Lien Systemio du module" placeholder="Lien direct Systemio (facultatif)" value={f.url ?? ""} onChange={(e) => setF({ ...f, url: e.target.value })} />
        <button className="btn btn-sm btn-light" onClick={() => onSave(f)}>Enregistrer</button>
      </div>
    </div>
  );
}
