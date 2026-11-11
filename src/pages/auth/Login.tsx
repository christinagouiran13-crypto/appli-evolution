import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import logo from "../../components/logo-vert.svg";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError("E-mail ou mot de passe incorrect.");
  }

  async function forgot() {
    setError(null);
    if (!email.trim()) { setError("Écris d'abord ton adresse e-mail ci-dessus."); return; }
    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/bienvenue` });
    setInfo("Si cette adresse a un compte, tu vas recevoir un e-mail. Rien reçu d'ici 10 minutes ? Préviens Christina : elle peut t'envoyer un nouveau lien de connexion.");
  }

  return (
    <div className="app">
      <form className="page" onSubmit={submit} style={{ justifyContent: "center", paddingBottom: 40 }}>
        <div className="stack center" style={{ alignItems: "center" }}>
          <img src={logo} alt="" width={88} height={64} />
          <h1 className="h1">Évolution</h1>
          <p className="muted" style={{ margin: 0 }}>Ton espace de suivi mental avec Christina</p>
        </div>
        <div className="field">
          <label htmlFor="email">Adresse e-mail</label>
          <input id="email" className="input" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pw">Mot de passe</label>
          <input id="pw" className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <div className="error" role="alert">{error}</div>}
        {info && <div className="success">{info}</div>}
        <button className="btn btn-block" disabled={busy}>{busy ? "Connexion…" : "Me connecter"}</button>
        <button type="button" className="btn btn-ghost" onClick={forgot}>Mot de passe oublié ?</button>
        <p className="hint center">Pas encore de compte ? Utilise le lien d'inscription envoyé par Christina.<br />
          <Link to="/confidentialite">Confidentialité</Link></p>
      </form>
    </div>
  );
}
