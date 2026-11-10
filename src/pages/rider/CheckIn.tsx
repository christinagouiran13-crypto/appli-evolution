import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useMe } from "../../lib/auth";
import { currentWeek, programProgress } from "../../lib/dates";
import { CHECKIN_METRICS, g } from "../../lib/text";
import type { Checkin } from "../../lib/types";
import { Celebration } from "../../components/Celebration";
import { computeStreak } from "../../lib/streak";

type Vals = { confidence: number; stress: number; focus: number; motivation: number };

export default function CheckIn() {
  const { me, settings } = useMe();
  const nav = useNavigate();
  const [vals, setVals] = useState<Vals>({ confidence: 5, stress: 5, focus: 5, motivation: 5 });
  const [mind, setMind] = useState("");
  const [existing, setExisting] = useState<Checkin | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ streak: number } | null>(null);
  const week = currentWeek();
  const prog = programProgress(me, settings);

  useEffect(() => {
    supabase.from("checkins").select("*").eq("rider_id", me.id).eq("week_start", week).maybeSingle().then(({ data }) => {
      if (data) {
        setExisting(data as Checkin);
        setVals({ confidence: data.confidence, stress: data.stress, focus: data.focus, motivation: data.motivation });
        setMind(data.mind ?? "");
      }
      setLoading(false);
    });
  }, [me.id, week]);

  if (me.status !== "active") {
    return (
      <div className="page">
        <h1 className="h1">Check-in</h1>
        <div className="empty">Ton programme est terminé : le check-in de la semaine n'est plus proposé. Retrouve ton historique dans <Link to="/progression">ta progression</Link>.</div>
      </div>
    );
  }

  async function send() {
    setBusy(true); setError(null);
    const { error: err } = await supabase.from("checkins").upsert(
      { rider_id: me.id, week_start: week, ...vals, mind: mind.trim() || null },
      { onConflict: "rider_id,week_start" },
    );
    if (err) { setBusy(false); setError("Ton check-in n'est pas parti. Vérifie ta connexion et réessaie."); return; }
    const { data } = await supabase.from("checkins").select("week_start").eq("rider_id", me.id);
    setBusy(false);
    setDone({ streak: computeStreak((data ?? []).map((c) => c.week_start)).count });
  }

  return (
    <div className="page">
      <div className="muted small">{prog ? prog.label.replace(/ sur .*/, "") : "Cette semaine"}</div>
      <div className="stack-sm">
        <h1 className="h1">Comment tu te sens cette semaine ?</h1>
        <p className="muted" style={{ margin: 0 }}>Note chaque point de 1 à 10. Christina reçoit tes réponses directement.</p>
      </div>
      {existing && <div className="success">Tu as déjà fait ton check-in cette semaine. Tu peux le modifier.</div>}
      {!loading && (
        <div className="stack">
          {CHECKIN_METRICS.map((m) => (
            <div key={m.key} className="card slider-card">
              <div className="row-between">
                <label htmlFor={m.key} className="h3">{m.label}</label>
                <div className="slider-value" aria-hidden="true">{vals[m.key]}</div>
              </div>
              <input id={m.key} type="range" min={1} max={10} step={1} value={vals[m.key]}
                onChange={(e) => setVals({ ...vals, [m.key]: Number(e.target.value) })} />
              <div className="row-between tiny muted">
                <span>{"lowM" in m ? g(me, m.low, m.lowM) : m.low}</span>
                <span>{"highM" in m ? g(me, m.high, m.highM) : m.high}</span>
              </div>
            </div>
          ))}
          <div className="field">
            <label htmlFor="mind">Qu'est-ce qui t'occupe l'esprit en ce moment ?</label>
            <textarea id="mind" className="textarea" rows={3} placeholder="Une peur, une victoire, une question pour Christina…"
              value={mind} onChange={(e) => setMind(e.target.value)} />
          </div>
          {error && <div className="error" role="alert">{error}</div>}
          <button className="btn btn-block" onClick={send} disabled={busy}>
            {busy ? "Envoi…" : existing ? "Mettre à jour mon check-in" : "Envoyer mon check-in"}
          </button>
        </div>
      )}
      {done && (
        <Celebration title={`Merci ${me.first_name}, c'est envoyé !`} onClose={() => nav("/objectifs")}>
          <p style={{ margin: 0 }}>
            Ta confiance est à {vals.confidence}/10 cette semaine.
            {done.streak > 1 ? ` Ça fait ${done.streak} semaines d'affilée, bravo !` : " Christina regarde tes réponses."}
          </p>
          <p className="small muted" style={{ margin: 0 }}>Prochaine étape : tes objectifs de la semaine.</p>
        </Celebration>
      )}
    </div>
  );
}
