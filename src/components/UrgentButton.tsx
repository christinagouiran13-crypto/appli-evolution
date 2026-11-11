import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { Modal } from "./Modal";
import { Icon } from "./Icon";

// Bouton « Urgence » : prévient Christina tout de suite (notification prioritaire)
export function UrgentButton({ block }: { block?: boolean }) {
  const { profile, settings } = useAuth();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!profile || profile.role !== "rider" || profile.status !== "active") return null;

  async function send() {
    setBusy(true); setErr(null);
    const { error } = await supabase.from("messages").insert({ thread_rider_id: profile!.id, kind: "urgent", body: text.trim() || null });
    setBusy(false);
    if (error) return setErr("L'alerte n'est pas partie. Vérifie ta connexion et réessaie.");
    setSent(true);
  }

  const close = () => { setOpen(false); setSent(false); setText(""); };

  return (
    <>
      <button className={block ? "btn btn-block btn-urgent" : "urgent-pill"} onClick={() => setOpen(true)}>
        <Icon name="bell" size={block ? 20 : 16} stroke={2.2} />Urgence
      </button>
      {open && (
        <Modal title={sent ? "Christina est prévenue" : "Besoin de Christina rapidement ?"} onClose={close}>
          {!sent ? (
            <>
              <p className="muted" style={{ margin: 0 }}>
                Réservé aux moments où tu as vraiment besoin d'elle, par exemple en concours. Christina reçoit une alerte prioritaire sur son téléphone.
              </p>
              <label htmlFor="urg" className="label">En deux mots, que se passe-t-il ? (facultatif)</label>
              <textarea id="urg" className="textarea" rows={3} placeholder="Ex. : je passe dans 20 minutes et je panique" value={text} onChange={(e) => setText(e.target.value)} />
              {err && <div className="error">{err}</div>}
              <button className="btn btn-block btn-urgent" disabled={busy} onClick={send}>{busy ? "Envoi…" : "Prévenir Christina maintenant"}</button>
            </>
          ) : (
            <>
              <div className="success">Ton alerte est partie. Christina te répond dès que possible dans votre conversation.</div>
              <div className="h3">En attendant, ta boîte de secours :</div>
              <div className="rescue">{[profile.rescue_text, settings?.rescue_text].filter(Boolean).join("\n\n")}</div>
              <div className="row wrap">
                <Link className="btn btn-sm" to="/messages?fil=coach" onClick={close}>Ouvrir la conversation</Link>
                <Link className="btn btn-sm btn-light" to="/routine" onClick={close}>Ma routine</Link>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
