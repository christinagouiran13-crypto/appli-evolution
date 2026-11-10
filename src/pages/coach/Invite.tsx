import { useState } from "react";
import { callFunction } from "../../lib/supabase";
import { useMe } from "../../lib/auth";
import { PROGRAM_LABEL, g } from "../../lib/text";
import { todayISO } from "../../lib/dates";
import type { Program } from "../../lib/types";
import { Icon } from "../../components/Icon";

// Lien à transmettre à la cliente : copie, e-mail ou partage (SMS, WhatsApp…)
export function InviteLink({ link, firstName, email, isNew = true }: { link: string; firstName: string; email: string; isNew?: boolean }) {
  const [copied, setCopied] = useState(false);
  const subject = isNew ? "Ton accès à l'appli Évolution" : "Ton nouveau lien de connexion Évolution";
  const body = isNew
    ? `Coucou ${firstName},\n\nBienvenue dans Évolution ! Voici ton lien personnel pour créer ton accès à l'appli (il est valable 24 h) :\n\n${link}\n\n1. Ouvre le lien sur ton téléphone (dans Safari si tu as un iPhone).\n2. Choisis ton mot de passe.\n3. Ajoute l'appli sur ton écran d'accueil : bouton Partager puis « Sur l'écran d'accueil » sur iPhone, menu ⋮ puis « Installer l'application » sur Android.\n4. Active les notifications pour recevoir mes messages.\n\nÀ très vite,\nChristina`
    : `Coucou ${firstName},\n\nVoici ton lien pour te reconnecter à l'appli Évolution et choisir un nouveau mot de passe (valable 24 h) :\n\n${link}\n\nChristina`;
  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="card-soft stack">
      <div className="bold">Lien prêt pour {firstName}. Envoie-le lui maintenant, il est valable 24 heures.</div>
      <input className="input" readOnly value={link} aria-label="Lien d'invitation" onFocus={(e) => e.target.select()} />
      <div className="row wrap">
        <a className="btn btn-sm" href={`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}><Icon name="send" size={16} />Envoyer par e-mail</a>
        {"share" in navigator && (
          <button className="btn btn-sm btn-light" onClick={() => navigator.share({ title: subject, text: body })}><Icon name="share" size={16} />Envoyer par SMS ou autre</button>
        )}
        <button className="btn btn-sm btn-light" onClick={copy}><Icon name="copy" size={16} />{copied ? "Copié !" : "Copier le lien"}</button>
      </div>
    </div>
  );
}

const EMPTY = {
  first_name: "", last_name: "", email: "", gender: "f" as "f" | "m", program: "starter90" as Program,
  program_start: todayISO(), is_junior: false, parent_name: "", parent_email: "", parent_consent: false,
};

export default function Invite() {
  useMe();
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ link: string; first_name: string; email: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (f.is_junior && (!f.parent_name.trim() || !f.parent_consent)) return setErr("Pour une junior, indique le parent et coche son accord.");
    setBusy(true);
    try {
      const r = await callFunction<{ link: string }>("coach-admin", { action: "invite", ...f });
      setResult({ link: r.link, first_name: f.first_name, email: f.email });
      setF(EMPTY);
    } catch (e2) {
      setErr((e2 as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className="stack-lg" style={{ maxWidth: 680 }}>
      <div className="stack-sm">
        <h1 className="h1">Inviter une cliente</h1>
        <p className="muted" style={{ margin: 0 }}>Après la vente, crée son accès ici. Utilise la même adresse e-mail que sur Systemio.</p>
      </div>
      {result && <InviteLink link={result.link} firstName={result.first_name} email={result.email} />}
      <form className="card card-lg stack" onSubmit={submit}>
        <div className="row wrap">
          <div className="field grow"><label htmlFor="ifn">Prénom</label><input id="ifn" className="input" required value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} /></div>
          <div className="field grow"><label htmlFor="iln">Nom</label><input id="iln" className="input" value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} /></div>
        </div>
        <div className="field"><label htmlFor="iem">Adresse e-mail</label><input id="iem" className="input" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div className="field"><span className="label">Textes de l'appli</span>
          <div className="pills"><button type="button" className="pill" aria-pressed={f.gender === "f"} onClick={() => setF({ ...f, gender: "f" })}>Cavalière</button>
            <button type="button" className="pill" aria-pressed={f.gender === "m"} onClick={() => setF({ ...f, gender: "m" })}>Cavalier</button></div></div>
        <div className="field"><span className="label">Programme</span>
          <div className="pills">{(["starter90", "levelup180", "club"] as const).map((k) => (
            <button type="button" key={k} className="pill" aria-pressed={f.program === k} onClick={() => setF({ ...f, program: k })}>{PROGRAM_LABEL[k]}</button>
          ))}</div></div>
        <div className="field" style={{ maxWidth: 260 }}><label htmlFor="ips">Date de début</label>
          <input id="ips" className="input" type="date" required value={f.program_start} onChange={(e) => setF({ ...f, program_start: e.target.value })} /></div>
        <label className="check"><input type="checkbox" checked={f.is_junior} onChange={(e) => setF({ ...f, is_junior: e.target.checked })} />
          <span>Offre Junior (10-12 ans) : {g(f, "la cliente", "le client")} est mineur{f.gender === "f" ? "e" : ""}</span></label>
        {f.is_junior && (
          <div className="card stack" style={{ background: "var(--creme)" }}>
            <div className="small">Pour une mineure, l'accord d'un parent est obligatoire avant de créer le compte.</div>
            <div className="field"><label htmlFor="ipn">Nom du parent</label><input id="ipn" className="input" value={f.parent_name} onChange={(e) => setF({ ...f, parent_name: e.target.value })} /></div>
            <div className="field"><label htmlFor="ipe">E-mail du parent</label><input id="ipe" className="input" type="email" value={f.parent_email} onChange={(e) => setF({ ...f, parent_email: e.target.value })} /></div>
            <label className="check"><input type="checkbox" checked={f.parent_consent} onChange={(e) => setF({ ...f, parent_consent: e.target.checked })} />
              <span>J'ai l'accord écrit du parent (par exemple par e-mail) pour créer ce compte et enregistrer ses données de suivi.</span></label>
          </div>
        )}
        {err && <div className="error" role="alert">{err}</div>}
        <button className="btn" disabled={busy}>{busy ? "Création…" : "Créer son accès"}</button>
      </form>
    </div>
  );
}
