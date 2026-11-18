import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Icon } from "./Icon";

type QR = { id: string; title: string; body: string; position: number };

// Gestion des réponses types (bouton ⚡ dans les conversations)
export function QuickRepliesAdmin() {
  const [list, setList] = useState<QR[]>([]);
  const [f, setF] = useState({ title: "", body: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(() => {
    supabase.from("quick_replies").select("*").order("position").order("created_at").then(({ data }) => setList((data as QR[]) ?? []));
  }, []);
  useEffect(load, [load]);
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 2000); };

  async function add() {
    if (!f.title.trim() || !f.body.trim()) return flash("Donne un titre et un texte.");
    await supabase.from("quick_replies").insert({ title: f.title.trim(), body: f.body.trim(), position: list.length });
    setF({ title: "", body: "" });
    load(); flash("Réponse ajoutée.");
  }
  async function save(q: QR) {
    await supabase.from("quick_replies").update({ title: q.title, body: q.body }).eq("id", q.id);
    load(); flash("Enregistré.");
  }
  async function del(q: QR) {
    if (!confirm(`Supprimer « ${q.title} » ?`)) return;
    await supabase.from("quick_replies").delete().eq("id", q.id);
    load();
  }

  return (
    <section className="stack">
      <div className="stack-sm">
        <h2 className="h2">Réponses types</h2>
        <p className="muted small" style={{ margin: 0 }}>
          Dans une conversation, touche ⚡ à côté du « + » : la réponse se met dans la zone de texte, avec le prénom de la cavalière
          (<b>{"{prenom}"}</b>). Tu peux la retoucher avant d'envoyer.
        </p>
      </div>
      {msg && <div className="success">{msg}</div>}
      {list.map((q) => <Row key={q.id} q={q} onSave={save} onDelete={del} />)}
      <div className="card card-lg stack-sm">
        <div className="h3">Nouvelle réponse type</div>
        <input className="input" aria-label="Titre" placeholder="Titre court (ex. : Merci pour ton vocal)" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <textarea className="textarea" rows={3} aria-label="Texte" placeholder="Le message (tu peux écrire {prenom})" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
        <button className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={add}><Icon name="plus" size={16} />Ajouter</button>
      </div>
    </section>
  );
}

function Row({ q, onSave, onDelete }: { q: QR; onSave: (q: QR) => void; onDelete: (q: QR) => void }) {
  const [f, setF] = useState(q);
  useEffect(() => setF(q), [q]);
  return (
    <div className="card stack-sm">
      <input className="input" aria-label="Titre" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <textarea className="textarea" rows={3} aria-label="Texte" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
      <div className="row">
        <button className="btn btn-sm btn-light" onClick={() => onSave(f)}>Enregistrer</button>
        <button className="btn btn-sm btn-ghost" onClick={() => onDelete(q)}>Supprimer</button>
      </div>
    </div>
  );
}
