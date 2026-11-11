import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useMe } from "../../lib/auth";
import { fmtDate, todayISO } from "../../lib/dates";
import { FEEDBACK_QUESTIONS } from "../../lib/text";
import type { Competition, Feedback } from "../../lib/types";
import { BackHeader } from "../../components/BackHeader";
import { Celebration } from "../../components/Celebration";
import { FeedbackDetails } from "../../components/FeedbackDetails";

// Questionnaire de feedback après concours
export default function FeedbackForm() {
  const { me } = useMe();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const compId = params.get("concours");
  const [comp, setComp] = useState<Competition | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayISO());
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!compId) return;
    supabase.from("competitions").select("*").eq("id", compId).single().then(({ data }) => {
      if (data) {
        setComp(data as Competition);
        setDate(data.date);
        setTitle([data.event, data.location].filter(Boolean).join(" · "));
      }
    });
  }, [compId]);

  async function send() {
    const filled = Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
    if (Object.keys(filled).length === 0) return setErr("Réponds au moins à une question.");
    setBusy(true); setErr(null);
    const { error } = await supabase.from("competition_feedback").insert({ competition_id: compId, date, title, answers: filled });
    setBusy(false);
    if (error) return setErr("Ton feedback n'est pas parti. Vérifie ta connexion et réessaie.");
    setSent(true);
  }

  if (me.status !== "active") return <div className="page"><BackHeader /><div className="empty">Le questionnaire est réservé aux accompagnements en cours.</div></div>;

  return (
    <div className="page">
      <BackHeader label="Après le concours" />
      <div className="stack-sm">
        <h1 className="h1">Feedback après concours</h1>
        <p className="muted" style={{ margin: 0 }}>
          {comp ? `${fmtDate(comp.date)}${comp.location ? ` · ${comp.location}` : ""}${comp.event ? ` · ${comp.event}` : ""}. ` : ""}
          Réponds avec tes mots, même en quelques phrases. Tu peux passer une question.
        </p>
      </div>
      {!comp && (
        <div className="stack">
          <div className="field"><label htmlFor="ft">Concours</label>
            <input id="ft" className="input" placeholder="Ex. : Amateur 2 à Lamotte" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="field"><label htmlFor="fd">Date</label>
            <input id="fd" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
      )}
      {FEEDBACK_QUESTIONS.map((q, i) => (
        <div key={q.key} className="field">
          <label htmlFor={q.key}>{i + 1}. {me.gender === "m" ? q.m : q.f}</label>
          <textarea id={q.key} className="textarea" rows={3} value={answers[q.key] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.key]: e.target.value })} />
        </div>
      ))}
      {err && <div className="error" role="alert">{err}</div>}
      <button className="btn btn-block" disabled={busy} onClick={send}>{busy ? "Envoi…" : "Envoyer mon feedback"}</button>
      {sent && (
        <Celebration title="Merci pour ton feedback !" onClose={() => nav("/indispensables")}>
          <p style={{ margin: 0 }}>Christina le lit et s'en sert pour préparer la suite avec toi.</p>
        </Celebration>
      )}
    </div>
  );
}

export function FeedbackView() {
  const { me } = useMe();
  const { id } = useParams();
  const [f, setF] = useState<Feedback | null>(null);
  useEffect(() => {
    supabase.from("competition_feedback").select("*").eq("id", id).single().then(({ data }) => setF(data as Feedback));
  }, [id]);
  if (!f) return <div className="loading">Chargement…</div>;
  return (
    <div className="page">
      <BackHeader />
      <FeedbackDetails f={f} p={me} />
    </div>
  );
}
