import { useEffect, useState } from "react";
import { callFunction } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { Modal } from "./Modal";
import { Celebration } from "./Celebration";

// Réservation Calendly dans l'appli : la réservation est détectée automatiquement
export function BookingModal({ onClose, onBooked }: { onClose: () => void; onBooked: () => void }) {
  const { profile, settings } = useAuth();
  const [done, setDone] = useState<{ number: number | null } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const onMsg = async (e: MessageEvent) => {
      if (!/^https:\/\/([a-z0-9-]+\.)?calendly\.com$/.test(e.origin)) return;
      const d = e.data as { event?: string; payload?: { event?: { uri?: string } } };
      if (d?.event !== "calendly.event_scheduled") return;
      try {
        const r = await callFunction<{ session: { number: number | null } }>("booking", { event_uri: d.payload?.event?.uri ?? "" });
        setDone({ number: r.session?.number ?? null });
        onBooked();
      } catch (e2) {
        setErr((e2 as Error).message + " Ta réservation chez Calendly est bien faite : préviens Christina.");
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [onBooked]);

  if (!settings || !profile) return null;
  const url = new URL(settings.calendly_url);
  url.searchParams.set("embed_domain", location.host);
  url.searchParams.set("embed_type", "Inline");
  url.searchParams.set("hide_gdpr_banner", "1");
  url.searchParams.set("name", `${profile.first_name} ${profile.last_name}`.trim());
  if (profile.email) url.searchParams.set("email", profile.email);

  if (done) {
    return (
      <Celebration title={done.number ? `Séance ${done.number} réservée !` : "Séance réservée !"} onClose={onClose}>
        <p style={{ margin: 0 }}>
          {profile.is_junior
            ? "Tu reçois la confirmation par e-mail. Après la séance, ta nouvelle mission arrivera dans tes messages."
            : "Tu reçois la confirmation par e-mail. Christina est prévenue."}
        </p>
      </Celebration>
    );
  }

  return (
    <Modal title="Réserver ma séance" onClose={onClose}>
      <p className="small muted" style={{ margin: 0 }}>{settings.slots_text} Choisis ton créneau ci-dessous.</p>
      {err && <div className="error">{err}</div>}
      <iframe title="Agenda de Christina" src={url.toString()} style={{ width: "100%", height: "70dvh", minHeight: 520, border: 0, borderRadius: 16, background: "#fff" }} />
    </Modal>
  );
}
