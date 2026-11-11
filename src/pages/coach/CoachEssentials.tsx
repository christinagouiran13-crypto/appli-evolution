import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import type { JuniorMission } from "../../lib/types";
import { ResourceManager } from "../../components/Resources";
import { Icon } from "../../components/Icon";

// Les indispensables communs à toutes les clientes + missions junior
export default function CoachEssentials() {
  const { settings, refresh } = useAuth();
  const [rescue, setRescue] = useState(settings?.rescue_text ?? "");
  const [msg, setMsg] = useState<string | null>(null);

  async function saveRescue() {
    const { error } = await supabase.from("app_settings").update({ rescue_text: rescue }).eq("id", true);
    setMsg(error ? "Pas enregistré, réessaie." : "Boîte de secours enregistrée.");
    setTimeout(() => setMsg(null), 2500);
    refresh();
  }

  return (
    <div className="stack-lg" style={{ maxWidth: 820 }}>
      <div className="stack-sm">
        <h1 className="h1">Indispensables</h1>
        <p className="muted" style={{ margin: 0 }}>
          Ce que tu mets ici est visible par <b>toutes</b> tes clientes, dans leur onglet « Indispensables ».
          Pour ajouter quelque chose à une seule cliente, ouvre sa fiche, onglet « Indispensables ».
        </p>
      </div>

      <section className="card card-lg stack">
        <h2 className="h2">Boîte de secours (commune)</h2>
        <div className="hint">S'affiche quand une cavalière ouvre sa boîte de secours, et juste après qu'elle a appuyé sur « Urgence ».</div>
        <textarea className="textarea" rows={7} aria-label="Boîte de secours commune" value={rescue} onChange={(e) => setRescue(e.target.value)} />
        {msg && <div className="success">{msg}</div>}
        <button className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={saveRescue}>Enregistrer</button>
      </section>

      <section className="stack">
        <h2 className="h2">Audios, questionnaire de feedback, fichiers et liens (pour toutes)</h2>
        <ResourceManager riderId={null} />
      </section>

      <Missions />
    </div>
  );
}

function Missions() {
  const [list, setList] = useState<JuniorMission[]>([]);
  const [f, setF] = useState({ title: "", body: "" });
  const load = useCallback(() => {
    supabase.from("junior_missions").select("*").order("position").order("created_at").then(({ data }) => setList((data as JuniorMission[]) ?? []));
  }, []);
  useEffect(load, [load]);

  async function add() {
    if (!f.title.trim()) return;
    await supabase.from("junior_missions").insert({ title: f.title.trim(), body: f.body.trim(), position: list.length });
    setF({ title: "", body: "" });
    load();
  }
  async function save(m: JuniorMission) {
    await supabase.from("junior_missions").update({ title: m.title, body: m.body }).eq("id", m.id);
    load();
  }
  async function del(m: JuniorMission) {
    if (!confirm(`Supprimer la mission « ${m.title} » ?`)) return;
    await supabase.from("junior_missions").delete().eq("id", m.id);
    load();
  }
  async function move(i: number, d: number) {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const a = [...list];
    [a[i], a[j]] = [a[j], a[i]];
    await Promise.all(a.map((m, k) => supabase.from("junior_missions").update({ position: k }).eq("id", m.id)));
    load();
  }

  return (
    <section className="stack">
      <div className="stack-sm">
        <h2 className="h2">Missions junior</h2>
        <div className="hint">Tous les 15 jours, chaque junior reçoit la mission suivante de cette liste, avec un rappel pour réserver sa séance. Elles partent dans l'ordre.</div>
      </div>
      {list.length === 0 && <div className="empty">Aucune mission pour l'instant. Tant que la liste est vide, les juniors reçoivent seulement le rappel de séance.</div>}
      {list.map((m, i) => <MissionRow key={m.id} m={m} n={i + 1} onSave={save} onDelete={del} onUp={() => move(i, -1)} />)}
      <div className="card card-lg stack">
        <div className="h3">Nouvelle mission</div>
        <input className="input" aria-label="Titre de la mission" placeholder="Titre (ex. : Ma bulle de concentration)" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <textarea className="textarea" aria-label="Consigne" placeholder="La consigne de la mission" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
        <button className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={add}><Icon name="plus" size={16} />Ajouter la mission</button>
      </div>
    </section>
  );
}

function MissionRow({ m, n, onSave, onDelete, onUp }: { m: JuniorMission; n: number; onSave: (m: JuniorMission) => void; onDelete: (m: JuniorMission) => void; onUp: () => void }) {
  const [f, setF] = useState(m);
  useEffect(() => setF(m), [m]);
  return (
    <div className="card stack-sm">
      <div className="row-between"><b>Mission {n}</b>
        <div className="row" style={{ gap: 4 }}>
          <button className="icon-btn" style={{ width: 36, height: 36 }} aria-label="Monter" onClick={onUp}>↑</button>
          <button className="btn btn-ghost btn-sm" onClick={() => onDelete(m)}>Supprimer</button>
        </div></div>
      <input className="input" aria-label="Titre" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <textarea className="textarea" aria-label="Consigne" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
      <button className="btn btn-sm btn-light" style={{ alignSelf: "flex-start" }} onClick={() => onSave(f)}>Enregistrer</button>
    </div>
  );
}
