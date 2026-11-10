import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { g } from "../../lib/text";
import logo from "../../components/logo-vert.svg";

// Page ouverte depuis le lien d'invitation (ou un nouveau lien de connexion) :
// la cliente choisit son mot de passe et donne son accord.
export default function Welcome() {
  const { profile, refresh } = useAuth();
  const nav = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [consent, setConsent] = useState(false);
  const [sensitive, setSensitive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!profile) return <div className="loading">Ouverture de ton invitation…</div>;
  const firstTime = !profile.consent_at && profile.role === "rider";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw.length < 8) return setError("Ton mot de passe doit faire au moins 8 caractères.");
    if (pw !== pw2) return setError("Les deux mots de passe ne sont pas identiques.");
    if (firstTime && (!consent || !sensitive)) return setError("Coche les deux cases pour continuer.");
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password: pw });
    if (err) {
      setBusy(false);
      return setError(/different|same/i.test(err.message) ? "Choisis un mot de passe différent de l'ancien." : "Impossible d'enregistrer le mot de passe. Réessaie.");
    }
    if (profile!.role === "rider") await supabase.rpc("activate_account");
    await refresh();
    setBusy(false);
    nav(profile!.role === "coach" ? "/coach" : "/", { replace: true });
  }

  return (
    <div className="app">
      <form className="page" onSubmit={submit} style={{ paddingBottom: 40 }}>
        <img src={logo} alt="" width={66} height={48} />
        <h1 className="h1">{firstTime ? `Bienvenue ${profile.first_name} !` : "Nouveau mot de passe"}</h1>
        {firstTime && (
          <p className="muted" style={{ margin: 0 }}>
            Voici ton espace Évolution. Tu y retrouveras ton check-in, tes concours, ta routine et tes messages avec Christina.
            Choisis ton mot de passe pour te connecter.
          </p>
        )}
        <div className="field">
          <label htmlFor="pw">Mot de passe (8 caractères minimum)</label>
          <input id="pw" className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pw2">Confirme ton mot de passe</label>
          <input id="pw2" className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </div>
        {firstTime && (
          <div className="card stack">
            {profile.is_junior && (
              <p className="small" style={{ margin: 0 }}>
                Ton compte a été créé avec l'accord de ton parent{profile.parent_name ? ` (${profile.parent_name})` : ""}.
                Lis ces lignes avec lui ou elle avant de cocher.
              </p>
            )}
            <label className="check">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>J'ai lu la <Link to="/confidentialite" target="_blank">page de confidentialité</Link> et j'accepte les conditions d'utilisation de l'appli.</span>
            </label>
            <label className="check">
              <input type="checkbox" checked={sensitive} onChange={(e) => setSensitive(e.target.checked)} />
              <span>J'accepte que mes réponses (humeur, stress, confiance, débriefs) soient enregistrées et lues par Christina pour mon suivi.
                Je peux demander leur suppression à tout moment.</span>
            </label>
          </div>
        )}
        {error && <div className="error" role="alert">{error}</div>}
        <button className="btn btn-block" disabled={busy}>{busy ? "Un instant…" : firstTime ? `C'est parti, ${g(profile, "cavalière", "cavalier")} !` : "Enregistrer"}</button>
      </form>
    </div>
  );
}
