import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Tpl = { code: string; label: string; body: string; enabled: boolean; sort: number };

const WHEN: Record<string, string> = {
  welcome: "Dans sa conversation privée, dès qu'elle active son compte.",
  tuesday_a: "Le mardi à 9 h, une semaine sur deux (en alternance avec B).",
  tuesday_b: "Le mardi à 9 h, une semaine sur deux (en alternance avec A).",
  eve_competition: "La veille d'un concours noté dans son calendrier, à 18 h.",
  after_competition: "Le lendemain d'un concours à 10 h, si le débrief n'est pas fait.",
  no_checkin_7d: "Après 7 jours sans check-in, à 10 h (une seule fois).",
  eve_session: "La veille d'une séance, à 18 h.",
  end_starter: "Le jour de la fin de Starter 90, à 10 h.",
};

export default function AutoMessages() {
  const [list, setList] = useState<Tpl[]>([]);
  const [saved, setSaved] = useState<string | null>(null);
  useEffect(() => {
    supabase.from("auto_messages").select("*").order("sort").then(({ data }) => setList((data as Tpl[]) ?? []));
  }, []);
  async function save(t: Tpl) {
    const { error } = await supabase.from("auto_messages").update({ body: t.body, enabled: t.enabled }).eq("code", t.code);
    setSaved(error ? "Erreur, réessaie." : `« ${t.label} » enregistré.`);
    setTimeout(() => setSaved(null), 2500);
  }
  const set = (code: string, patch: Partial<Tpl>) => setList(list.map((x) => (x.code === code ? { ...x, ...patch } : x)));
  return (
    <div className="stack-lg" style={{ maxWidth: 820 }}>
      <div className="stack-sm">
        <h1 className="h1">Messages automatiques</h1>
        <p className="muted" style={{ margin: 0 }}>
          Écris-les une fois avec tes mots : l'appli les envoie à ta place, dans la conversation privée de chaque cliente, avec une notification.
          Tu peux utiliser <b>{"{prenom}"}</b> (son prénom), <b>{"{cavaliere}"}</b> (cavalière ou cavalier), et pour la veille de séance <b>{"{heure}"}</b> et <b>{"{lien}"}</b>.
        </p>
      </div>
      {saved && <div className="success">{saved}</div>}
      {list.map((t) => (
        <div key={t.code} className="card card-lg stack-sm">
          <div className="row-between wrap">
            <b>{t.label}</b>
            <label className="check" style={{ padding: 0 }}><input type="checkbox" checked={t.enabled} onChange={(e) => set(t.code, { enabled: e.target.checked })} /><span>Activé</span></label>
          </div>
          <div className="hint">{WHEN[t.code]}</div>
          <textarea className="textarea" rows={3} aria-label={t.label} value={t.body} onChange={(e) => set(t.code, { body: e.target.value })} />
          <button className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => save(t)}>Enregistrer</button>
        </div>
      ))}
    </div>
  );
}
