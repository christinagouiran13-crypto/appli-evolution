import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { newId, signedUrl, upload } from "../lib/storage";
import type { Resource } from "../lib/types";
import { Icon } from "./Icon";
import { useSigned } from "./Media";

const CATEGORY_LABEL: Record<Resource["category"], string> = {
  audio: "Audio de préparation mentale",
  fichier: "Fichier",
  lien: "Lien",
  feedback: "Questionnaire de feedback",
};

function ResourceAudio({ path }: { path: string }) {
  const url = useSigned("resources", path);
  return url ? <audio controls preload="metadata" src={url} style={{ width: "100%" }} /> : <div className="small muted">Chargement…</div>;
}

async function openFile(path: string) {
  const url = await signedUrl("resources", path);
  if (url) window.open(url, "_blank", "noopener");
}

// Affichage d'une ressource (côté cavalière et coach)
export function ResourceCard({ r, onDelete }: { r: Resource; onDelete?: () => void }) {
  const isAudio = r.category === "audio" && r.path;
  return (
    <div className="card stack-sm">
      <div className="row-between">
        <div className="row" style={{ gap: 10 }}>
          <div className="icon-tile"><Icon name={r.category === "audio" ? "mic" : r.category === "lien" ? "external" : r.category === "feedback" ? "edit" : "book"} size={20} /></div>
          <div><div className="h3">{r.title}</div>{r.description && <div className="small muted">{r.description}</div>}</div>
        </div>
        {onDelete && <button className="btn btn-ghost btn-sm" onClick={onDelete}>Supprimer</button>}
      </div>
      {isAudio && <ResourceAudio path={r.path!} />}
      {!isAudio && r.path && <button className="btn btn-sm btn-light" style={{ alignSelf: "flex-start" }} onClick={() => openFile(r.path!)}>Ouvrir</button>}
      {r.url && <a className="btn btn-sm btn-light" style={{ alignSelf: "flex-start" }} href={r.url} target="_blank" rel="noreferrer">Ouvrir le lien</a>}
    </div>
  );
}

export function useResources(riderId: string | null | "mine") {
  const [list, setList] = useState<Resource[]>([]);
  const load = useCallback(async () => {
    let q = supabase.from("resources").select("*").order("created_at");
    if (riderId === null) q = q.is("rider_id", null);
    else if (riderId !== "mine") q = q.eq("rider_id", riderId);
    const { data } = await q;
    setList((data as Resource[]) ?? []);
  }, [riderId]);
  useEffect(() => { load(); }, [load]);
  return { list, reload: load };
}

// Gestion par la coach : pour toutes (riderId = null) ou pour une cliente
export function ResourceManager({ riderId }: { riderId: string | null }) {
  const { list, reload } = useResources(riderId);
  const [f, setF] = useState({ category: "audio" as Resource["category"], title: "", description: "", url: "" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function add() {
    setMsg(null);
    if (!f.title.trim()) return setMsg("Donne un titre.");
    if (f.category === "lien" && !f.url.trim()) return setMsg("Colle le lien.");
    if (f.category === "feedback" && !f.url.trim() && !file) return setMsg("Colle le lien du questionnaire ou choisis un fichier.");
    if ((f.category === "audio" || f.category === "fichier") && !file) return setMsg("Choisis un fichier.");
    if (file && file.size > 50 * 1024 * 1024) return setMsg("Fichier trop lourd (50 Mo maximum).");
    setBusy(true);
    try {
      let path: string | null = null;
      if (file && f.category !== "lien") {
        const ext = (file.name.split(".").pop() || "bin").toLowerCase();
        path = `${riderId ?? "commun"}/${newId()}.${ext}`;
        await upload("resources", path, file);
      }
      const { error } = await supabase.from("resources").insert({
        rider_id: riderId, category: f.category, title: f.title.trim(),
        description: f.description.trim() || null, path, url: f.url.trim() || null,
      });
      if (error) throw error;
      setF({ ...f, title: "", description: "", url: "" });
      setFile(null);
      setMsg("Ajouté.");
      reload();
    } catch {
      setMsg("L'ajout n'a pas marché. Réessaie.");
    }
    setBusy(false);
  }

  async function remove(r: Resource) {
    if (!confirm(`Supprimer « ${r.title} » ?`)) return;
    if (r.path) await supabase.storage.from("resources").remove([r.path]);
    await supabase.from("resources").delete().eq("id", r.id);
    reload();
  }

  return (
    <div className="stack">
      {list.length === 0 && <div className="empty">Rien pour l'instant.</div>}
      {list.map((r) => <ResourceCard key={r.id} r={r} onDelete={() => remove(r)} />)}
      <div className="card card-lg stack">
        <div className="h3">Ajouter</div>
        <div className="pills" role="group" aria-label="Type">
          {(Object.keys(CATEGORY_LABEL) as Resource["category"][]).map((k) => (
            <button key={k} className="pill" aria-pressed={f.category === k} onClick={() => setF({ ...f, category: k })}>{CATEGORY_LABEL[k]}</button>
          ))}
        </div>
        <input className="input" aria-label="Titre" placeholder="Titre (ex. : Visualisation du parcours)" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <input className="input" aria-label="Description" placeholder="Petite description (facultatif)" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        {f.category === "lien" || f.category === "feedback" ? (
          <input className="input" aria-label="Lien" placeholder={f.category === "feedback" ? "Lien du questionnaire (Google Forms, Typeform…) ou laisse vide et ajoute un PDF" : "https://…"} value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
        ) : null}
        {f.category !== "lien" && (
          <label className="btn btn-sm btn-light" style={{ alignSelf: "flex-start", cursor: "pointer" }}>
            <Icon name="plus" size={16} />{file ? file.name : f.category === "audio" ? "Choisir un audio" : "Choisir un fichier (PDF, image…)"}
            <input type="file" hidden accept={f.category === "audio" ? "audio/*" : undefined} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        )}
        {msg && <div className="hint">{msg}</div>}
        <button className="btn btn-sm" style={{ alignSelf: "flex-start" }} disabled={busy} onClick={add}>{busy ? "Envoi…" : "Ajouter"}</button>
      </div>
    </div>
  );
}
