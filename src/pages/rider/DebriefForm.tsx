import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useMe } from "../../lib/auth";
import { fmtDate, todayISO } from "../../lib/dates";
import { RESULTS, g } from "../../lib/text";
import type { Competition, Profile } from "../../lib/types";
import { BackHeader } from "../../components/BackHeader";
import { Celebration } from "../../components/Celebration";
import { ShareVictory } from "../../components/ShareVictory";

export function moments(p: Pick<Profile, "gender">, kind: "concours" | "cours") {
  return [
    { key: "mental_before" as const, label: kind === "cours" ? "Au début du cours" : "Avant d'entrer en piste", opts: [g(p, "Sereine", "Serein"), g(p, "Tendue", "Tendu"), g(p, "Paniquée", "Paniqué")] },
    { key: "mental_during" as const, label: kind === "cours" ? "Pendant le cours" : "Pendant le parcours", opts: ["Focus", g(p, "Dispersée", "Dispersé"), g(p, "Figée", "Figé")] },
    { key: "mental_after" as const, label: kind === "cours" ? "Après le cours" : "Après le parcours", opts: [g(p, "Fière", "Fier"), "Neutre", g(p, "Déçue", "Déçu")] },
  ];
}

export default function DebriefForm() {
  const { me } = useMe();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const compId = params.get("concours");
  const kind = params.get("type") === "cours" ? "cours" : "concours";
  const [comp, setComp] = useState<Competition | null>(null);
  const [f, setF] = useState({
    title: "", date: todayISO(), result: null as string | null,
    mental_before: null as string | null, mental_during: null as string | null, mental_after: null as string | null,
    went_well: "", change_next: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [share, setShare] = useState(false);

  useEffect(() => {
    if (!compId) return;
    supabase.from("competitions").select("*").eq("id", compId).single().then(({ data }) => {
      if (data) {
        setComp(data as Competition);
        setF((x) => ({ ...x, date: data.date, title: [data.event, data.height].filter(Boolean).join(" · ") }));
      }
    });
  }, [compId]);

  async function send() {
    if (kind === "concours" && !f.result) return setErr("Indique ton résultat.");
    setBusy(true); setErr(null);
    const { error } = await supabase.from("debriefs").insert({
      ...f, kind, competition_id: compId, went_well: f.went_well.trim() || null, change_next: f.change_next.trim() || null,
      title: f.title || (comp?.location ?? ""),
    });
    setBusy(false);
    if (error) return setErr("Ton débrief n'est pas parti. Vérifie ta connexion et réessaie.");
    setSent(true);
  }

  if (me.status !== "active") return <div className="page"><BackHeader /><div className="empty">Les débriefs sont réservés aux programmes en cours.</div></div>;

  return (
    <div className="page">
      <BackHeader label={kind === "cours" ? "Après le cours" : "Après le concours"} />
      <div className="stack-sm">
        <h1 className="h1">{kind === "cours" ? "Débrief de ton cours" : "Débrief de ton concours"}</h1>
        {comp && <p className="muted" style={{ margin: 0 }}>{fmtDate(comp.date)}{comp.location ? ` · ${comp.location}` : ""}{comp.event ? ` · ${comp.event}` : ""}{comp.height ? ` · ${comp.height}` : ""}</p>}
      </div>

      {!comp && (
        <div className="stack">
          <div className="field"><label htmlFor="dt">{kind === "cours" ? "Cours (titre libre)" : "Concours"}</label>
            <input id="dt" className="input" placeholder={kind === "cours" ? "Ex. : cours de saut avec Paul" : "Ex. : Amateur 2 à Lamotte"} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div className="field"><label htmlFor="dd">Date</label>
            <input id="dd" className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
        </div>
      )}

      {kind === "concours" && (
        <section className="stack">
          <h2 className="h2">Ton résultat</h2>
          <div className="pills" role="group" aria-label="Résultat">
            {RESULTS.map((r) => (
              <button key={r.code} className="pill" aria-pressed={f.result === r.code} onClick={() => setF({ ...f, result: r.code })}>{r.label}</button>
            ))}
          </div>
        </section>
      )}

      <section className="stack">
        <h2 className="h2">Ton mental, moment par moment</h2>
        {moments(me, kind).map((m) => (
          <div key={m.key} className="card stack-sm">
            <div className="h3">{m.label}</div>
            <div className="pills-3" role="group" aria-label={m.label}>
              {m.opts.map((o) => (
                <button key={o} className="pill" aria-pressed={f[m.key] === o} onClick={() => setF({ ...f, [m.key]: o })}>{o}</button>
              ))}
            </div>
          </div>
        ))}
      </section>

      <div className="field"><label htmlFor="ok">Ce qui a bien marché</label>
        <textarea id="ok" className="textarea" placeholder="Ex. : ma respiration au paddock, mon mot d'ancrage" value={f.went_well} onChange={(e) => setF({ ...f, went_well: e.target.value })} /></div>
      <div className="field"><label htmlFor="ch">Ce que je change la prochaine fois</label>
        <textarea id="ch" className="textarea" placeholder="Ex. : arriver plus tôt pour la reconnaissance" value={f.change_next} onChange={(e) => setF({ ...f, change_next: e.target.value })} /></div>

      {err && <div className="error" role="alert">{err}</div>}
      <button className="btn btn-block" onClick={send} disabled={busy}>{busy ? "Envoi…" : "Envoyer mon débrief"}</button>

      {sent && !share && (
        <Celebration title="Débrief envoyé !" onClose={() => nav("/concours")}>
          <p style={{ margin: 0 }}>Il est rangé dans ton historique. Christina le lit et te répond dans ta conversation.</p>
          {f.result === "sans_faute" && (
            <button className="btn btn-light" onClick={() => setShare(true)}>Partager mon sans-faute au groupe</button>
          )}
        </Celebration>
      )}
      {share && <ShareVictory initial={`Sans-faute ${f.title ? `en ${f.title}` : "ce week-end"} !`} onClose={() => nav("/concours")} />}
    </div>
  );
}
