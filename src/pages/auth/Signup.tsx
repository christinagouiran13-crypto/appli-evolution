import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { callFunction, supabase } from "../../lib/supabase";
import { PROGRAM_LABEL } from "../../lib/text";
import logo from "../../components/logo-vert.svg";

// Inscription autonome avec le lien partagé par Christina
export default function Signup() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const code = params.get("code") ?? "";
  const [f, setF] = useState({
    first_name: "", last_name: "", email: "", password: "", gender: "f" as "f" | "m",
    program: "starter90", program_start: "", is_junior: false, parent_name: "", parent_email: "", parent_consent: false,
    consent: false, sensitive: false,
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fem = f.gender === "f";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await callFunction("signup", { ...f, code });
      const { error } = await supabase.auth.signInWithPassword({ email: f.email.trim().toLowerCase(), password: f.password });
      if (error) throw new Error("Ton compte est créé : connecte-toi avec ton e-mail et ton mot de passe.");
      nav("/", { replace: true });
    } catch (e2) {
      setErr((e2 as Error).message);
    }
    setBusy(false);
  }

  if (!code) {
    return (
      <div className="app"><div className="page" style={{ justifyContent: "center" }}>
        <h1 className="h1">Lien incomplet</h1>
        <p className="muted">Utilise le lien d'inscription envoyé par Christina, ou <Link to="/connexion">connecte-toi</Link> si tu as déjà un compte.</p>
      </div></div>
    );
  }

  return (
    <div className="app">
      <form className="page" onSubmit={submit} style={{ paddingBottom: 40 }}>
        <img src={logo} alt="" width={66} height={48} />
        <h1 className="h1">Crée ton espace Évolution</h1>
        <p className="muted" style={{ margin: 0 }}>Utilise la <b>même adresse e-mail que sur ta plateforme de formation</b> (Systemio).</p>

        <div className="row wrap">
          <div className="field grow"><label htmlFor="sfn">Prénom</label><input id="sfn" className="input" required autoComplete="given-name" value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} /></div>
          <div className="field grow"><label htmlFor="sln">Nom</label><input id="sln" className="input" autoComplete="family-name" value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} /></div>
        </div>
        <div className="field"><span className="label">Je suis</span>
          <div className="pills">
            <button type="button" className="pill" aria-pressed={fem} onClick={() => setF({ ...f, gender: "f" })}>Cavalière</button>
            <button type="button" className="pill" aria-pressed={!fem} onClick={() => setF({ ...f, gender: "m" })}>Cavalier</button>
          </div></div>
        <div className="field"><label htmlFor="sem">Adresse e-mail</label><input id="sem" className="input" type="email" required autoComplete="email" inputMode="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div className="field"><label htmlFor="spw">Mot de passe (8 caractères minimum)</label><input id="spw" className="input" type="password" required autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>

        <div className="field"><span className="label">Mon accompagnement</span>
          <div className="pills">
            {(["starter90", "levelup180", "club"] as const).map((k) => (
              <button type="button" key={k} className="pill" aria-pressed={f.program === k} onClick={() => setF({ ...f, program: k })}>{PROGRAM_LABEL[k]}</button>
            ))}
            <button type="button" className="pill" aria-pressed={f.program === "termine"} onClick={() => setF({ ...f, program: "termine" })}>Accompagnement terminé</button>
          </div></div>
        {f.program !== "termine" && (
          <div className="field" style={{ maxWidth: 260 }}><label htmlFor="sps">Date de début (si tu la connais)</label>
            <input id="sps" className="input" type="date" value={f.program_start} onChange={(e) => setF({ ...f, program_start: e.target.value })} /></div>
        )}

        <label className="check"><input type="checkbox" checked={f.is_junior} onChange={(e) => setF({ ...f, is_junior: e.target.checked })} /><span>J'ai entre 10 et 12 ans (offre Junior)</span></label>
        {f.is_junior && (
          <div className="card stack">
            <div className="small">Fais cette inscription avec ton parent : son accord est obligatoire.</div>
            <div className="field"><label htmlFor="spn">Nom du parent</label><input id="spn" className="input" value={f.parent_name} onChange={(e) => setF({ ...f, parent_name: e.target.value })} /></div>
            <div className="field"><label htmlFor="spe">E-mail du parent</label><input id="spe" className="input" type="email" value={f.parent_email} onChange={(e) => setF({ ...f, parent_email: e.target.value })} /></div>
            <label className="check"><input type="checkbox" checked={f.parent_consent} onChange={(e) => setF({ ...f, parent_consent: e.target.checked })} />
              <span>Je suis le parent ou représentant légal et j'autorise la création de ce compte et l'enregistrement des données de suivi.</span></label>
          </div>
        )}

        <div className="card stack">
          <label className="check"><input type="checkbox" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} />
            <span>J'ai lu la <Link to="/confidentialite" target="_blank">page de confidentialité</Link> et j'accepte les conditions d'utilisation de l'appli.</span></label>
          <label className="check"><input type="checkbox" checked={f.sensitive} onChange={(e) => setF({ ...f, sensitive: e.target.checked })} />
            <span>J'accepte que mes réponses (humeur, stress, confiance, débriefs) soient enregistrées et lues par Christina pour mon suivi. Je peux demander leur suppression à tout moment.</span></label>
        </div>

        {err && <div className="error" role="alert">{err}</div>}
        <button className="btn btn-block" disabled={busy}>{busy ? "Création…" : "Créer mon compte"}</button>
        <p className="hint center">Déjà un compte ? <Link to="/connexion">Connecte-toi</Link></p>
      </form>
    </div>
  );
}
