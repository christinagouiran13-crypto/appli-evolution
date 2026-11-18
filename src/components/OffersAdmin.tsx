import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

type Offer = { title: string; tagline: string; description: string };
const KEYS = ["starter90", "levelup180", "club"];

// Textes de « Ton parcours Évolution » (vus par les cavalières dans Ma formation)
export function OffersAdmin() {
  const { settings, refresh } = useAuth();
  const [f, setF] = useState<Record<string, Offer>>((settings?.offers as Record<string, Offer>) ?? {});
  const [msg, setMsg] = useState<string | null>(null);
  const set = (k: string, patch: Partial<Offer>) => setF({ ...f, [k]: { ...f[k], ...patch } });
  async function save() {
    const { error } = await supabase.from("app_settings").update({ offers: f }).eq("id", true);
    setMsg(error ? "Pas enregistré." : "Textes enregistrés.");
    setTimeout(() => setMsg(null), 2500);
    refresh();
  }
  return (
    <section className="card card-lg stack">
      <div className="row-between wrap"><h2 className="h2">Ton parcours Évolution</h2><span className="tag tag-vert">✓ Déjà en ligne</span></div>
      <div className="hint">
        Présenté dans « Ma formation » : le programme en cours puis la suite. Le bouton « Ça m'intéresse » n'apparaît que dans les
        2 dernières semaines du programme ou une fois terminé ; tu reçois alors un message et une carte sur ton tableau de bord.
        Pas affiché pour les juniors pour l'instant.
      </div>
      {KEYS.map((k) => f[k] && (
        <div key={k} className="stack-sm" style={{ borderTop: "1px solid var(--bord)", paddingTop: 10 }}>
          <input className="input" aria-label="Nom du programme" value={f[k].title} onChange={(e) => set(k, { title: e.target.value })} />
          <input className="input" aria-label="Accroche" value={f[k].tagline} onChange={(e) => set(k, { tagline: e.target.value })} />
          <textarea className="textarea" rows={3} aria-label="Description" value={f[k].description} onChange={(e) => set(k, { description: e.target.value })} />
        </div>
      ))}
      {msg && <div className="success">{msg}</div>}
      <button className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={save}>Enregistrer les textes</button>
    </section>
  );
}
