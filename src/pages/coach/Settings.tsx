import { useState } from "react";
import { callFunction, supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import type { Settings as S } from "../../lib/types";
import { currentPushState, enablePush } from "../../lib/push";
import { useEffect } from "react";
import { Icon } from "../../components/Icon";

export default function Settings() {
  const { settings, refresh, signOut } = useAuth();
  const [f, setF] = useState<S>(settings!);
  const [msg, setMsg] = useState<string | null>(null);
  const [push, setPush] = useState("unknown");
  useEffect(() => { currentPushState().then(setPush); }, []);

  async function save() {
    const { error } = await supabase.from("app_settings").update({ ...f, updated_at: new Date().toISOString() }).eq("id", true);
    setMsg(error ? `Erreur : ${error.message}` : "Réglages enregistrés.");
    refresh();
  }
  const th = (k: keyof S["thresholds"], v: string) => setF({ ...f, thresholds: { ...f.thresholds, [k]: Number(v) } });

  return (
    <div className="stack-lg" style={{ maxWidth: 760 }}>
      <h1 className="h1">Réglages</h1>

      <section className="card card-lg stack">
        <h2 className="h2">Notifications sur cet appareil</h2>
        {push === "on" ? (
          <>
            <div className="success">Activées sur cet appareil : tu es prévenue des messages et des urgences.</div>
            <button className="btn btn-sm btn-light" style={{ alignSelf: "flex-start" }} onClick={async () => {
              try {
                const r = await callFunction<{ devices: number; sent: number }>("push", { type: "test" });
                setMsg(r.sent > 0 ? `Notification de test envoyée (${r.sent} appareil${r.sent > 1 ? "s" : ""}). Tu dois la voir dans quelques secondes.` : "Aucune notification n'a pu partir. Désactive puis réactive les notifications sur ce téléphone, ou préviens Claude.");
              } catch (e) { setMsg((e as Error).message); }
            }}>M'envoyer une notification de test</button>
          </>
        ) : (
          <button className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={async () => {
            try { await enablePush(); setPush("on"); } catch (e) { setMsg((e as Error).message); }
          }}><Icon name="bell" size={16} />Activer les notifications</button>
        )}
      </section>

      <section className="card card-lg stack">
        <h2 className="h2">Liens et textes</h2>
        <div className="field"><label htmlFor="sc">Lien Calendly</label><input id="sc" className="input" value={f.calendly_url} onChange={(e) => setF({ ...f, calendly_url: e.target.value })} /></div>
        <div className="field"><label htmlFor="st">Lien de la plateforme de formation (Systemio)</label><input id="st" className="input" value={f.training_url} onChange={(e) => setF({ ...f, training_url: e.target.value })} /></div>
        <div className="field"><label htmlFor="sr">Horaires de réponse (affichés dans la messagerie)</label><input id="sr" className="input" value={f.response_time_text} onChange={(e) => setF({ ...f, response_time_text: e.target.value })} /></div>
        <div className="field"><label htmlFor="ss">Créneaux de séance (affichés dans « Mes séances »)</label><input id="ss" className="input" value={f.slots_text} onChange={(e) => setF({ ...f, slots_text: e.target.value })} /></div>
      </section>

      <section className="card card-lg stack">
        <h2 className="h2">Seuils des alertes</h2>
        <div className="row wrap">
          <div className="field grow"><label htmlFor="t1">Confiance en baisse (points en 2 semaines)</label><input id="t1" className="input" type="number" min={1} max={9} value={f.thresholds.confidence_drop} onChange={(e) => th("confidence_drop", e.target.value)} /></div>
          <div className="field grow"><label htmlFor="t2">Décrochage (jours sans check-in)</label><input id="t2" className="input" type="number" min={3} max={60} value={f.thresholds.no_checkin_days} onChange={(e) => th("no_checkin_days", e.target.value)} /></div>
        </div>
        <div className="row wrap">
          <div className="field grow"><label htmlFor="t3">Fin de programme (jours avant)</label><input id="t3" className="input" type="number" min={1} max={30} value={f.thresholds.program_end_days} onChange={(e) => th("program_end_days", e.target.value)} /></div>
          <div className="field grow"><label htmlFor="t4">Stress élevé (note à partir de)</label><input id="t4" className="input" type="number" min={5} max={10} value={f.thresholds.stress_high} onChange={(e) => th("stress_high", e.target.value)} /></div>
        </div>
      </section>

      <section className="card card-lg stack">
        <h2 className="h2">Durée des programmes</h2>
        <div className="row wrap">
          <div className="field grow"><label htmlFor="p1">Starter 90 (semaines)</label><input id="p1" className="input" type="number" min={1} value={f.program_weeks.starter90} onChange={(e) => setF({ ...f, program_weeks: { ...f.program_weeks, starter90: Number(e.target.value) } })} /></div>
          <div className="field grow"><label htmlFor="p2">Level Up 180 (semaines)</label><input id="p2" className="input" type="number" min={1} value={f.program_weeks.levelup180} onChange={(e) => setF({ ...f, program_weeks: { ...f.program_weeks, levelup180: Number(e.target.value) } })} /></div>
        </div>
      </section>

      {msg && <div className="success">{msg}</div>}
      <div className="row wrap">
        <button className="btn" onClick={save}>Enregistrer les réglages</button>
        <button className="btn btn-light" onClick={signOut}><Icon name="logout" size={16} />Me déconnecter</button>
      </div>
    </div>
  );
}
