import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { callFunction, supabase } from "../../lib/supabase";
import { useMe } from "../../lib/auth";
import { addDays, fmtDate, fmtDateTime, fmtShort, programProgress, relativeDay } from "../../lib/dates";
import { BADGES, PROGRAM_LABEL, STARTER_SESSIONS, badgeName } from "../../lib/text";
import { newId, upload } from "../../lib/storage";
import type { Checkin, Debrief, Feedback, Phase, Profile, Routine, RoutineAudio, Session, WeeklyGoals } from "../../lib/types";
import { Avatar } from "../../components/Avatar";
import { Chat } from "../../components/Chat";
import { DebriefDetails } from "../../components/DebriefDetails";
import { FeedbackDetails } from "../../components/FeedbackDetails";
import { Icon } from "../../components/Icon";
import { LineChart } from "../../components/LineChart";
import { SignedAudio } from "../../components/Media";
import { PHASES } from "../rider/Routine";
import { InviteLink } from "./Invite";
import { ResourceManager } from "../../components/Resources";

const TABS = [
  ["suivi", "Suivi"], ["debriefs", "Débriefs et feedbacks"], ["objectifs", "Objectifs"], ["messages", "Messages"],
  ["routine", "Routine"], ["indispensables", "Indispensables"], ["seances", "Séances"], ["notes", "Notes privées"], ["gestion", "Gestion"],
] as const;

export default function ClientDetail() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get("onglet") ?? "suivi";
  const { settings } = useMe();
  const [p, setP] = useState<Profile | null>(null);

  const load = useCallback(() => {
    supabase.from("profiles").select("*").eq("id", id).single().then(({ data }) => setP(data as Profile));
  }, [id]);
  useEffect(load, [load]);

  if (!p) return <div className="loading">Chargement…</div>;
  const prog = programProgress(p, settings);

  return (
    <>
      <div className="row" style={{ gap: 16 }}>
        <Link to="/coach" className="icon-btn" aria-label="Retour au tableau de bord"><Icon name="back" size={20} /></Link>
        <Avatar path={p.avatar_path} name={p.first_name} size={56} />
        <div className="grow">
          <h1 className="h1">{p.first_name} {p.last_name}</h1>
          <div className="muted small">
            {p.program ? PROGRAM_LABEL[p.program] : ""}{prog ? ` · ${prog.label}` : ""}
            {p.status === "alumni" ? " · ancienne cliente" : p.status === "archived" ? " · archivée" : ""}
            {p.discipline ? ` · ${p.discipline}` : ""}{p.level ? ` ${p.level}` : ""}{p.horse_name ? ` · avec ${p.horse_name}` : ""}
            {p.is_junior ? " · junior" : ""}
          </div>
          {p.season_goal && <div className="small">Objectif de saison : <b>{p.season_goal}</b> ({p.season_goal_progress} %)</div>}
        </div>
        {p.status === "active" && <FinishButton p={p} onDone={load} />}
      </div>

      <div className="tabs-line" role="group" aria-label="Sections de la fiche">
        {TABS.map(([k, l]) => <button key={k} aria-pressed={tab === k} onClick={() => setParams({ onglet: k })}>{l}</button>)}
      </div>

      {tab === "suivi" && <Suivi p={p} />}
      {tab === "debriefs" && <Debriefs p={p} />}
      {tab === "objectifs" && <Objectifs p={p} />}
      {tab === "messages" && (
        <div className="chat-embed"><Chat thread={p.id} className="chat" /></div>
      )}
      {tab === "routine" && <RoutineEditor p={p} onSaved={load} />}
      {tab === "indispensables" && <PersonalEssentials p={p} onSaved={load} />}
      {tab === "seances" && <Seances p={p} />}
      {tab === "notes" && <Notes p={p} />}
      {tab === "gestion" && <Gestion p={p} onSaved={load} />}
    </>
  );
}

/* ---------- Suivi : courbes + check-ins ---------- */
function Suivi({ p }: { p: Profile }) {
  const [list, setList] = useState<Checkin[]>([]);
  const [badges, setBadges] = useState<string[]>([]);
  useEffect(() => {
    supabase.from("checkins").select("*").eq("rider_id", p.id).order("week_start").then(({ data }) => setList((data as Checkin[]) ?? []));
    supabase.from("badges").select("code").eq("rider_id", p.id).then(({ data }) => setBadges((data ?? []).map((b) => b.code)));
  }, [p.id]);
  const last = list.slice(-16);
  return (
    <div className="two-col">
      <div className="card card-lg stack">
        <h2 className="h2">Ses notes semaine après semaine</h2>
        {last.length === 0 ? <div className="muted small">Pas encore de check-in.</div> : (
          <LineChart labels={last.map((c) => fmtShort(c.week_start))} height={200} series={[
            { label: "Confiance", color: "#2F5D50", values: last.map((c) => c.confidence) },
            { label: "Stress", color: "#C0675A", values: last.map((c) => c.stress), dashed: true },
            { label: "Concentration", color: "#4C7DB0", values: last.map((c) => c.focus) },
            { label: "Motivation", color: "#C9A13B", values: last.map((c) => c.motivation) },
          ]} />
        )}
        <div className="row wrap">
          {BADGES.filter((b) => badges.includes(b.code)).map((b) => <span key={b.code} className="tag tag-vert">{badgeName(b, p)}</span>)}
        </div>
      </div>
      <div className="stack">
        <h2 className="h2">Ses check-ins</h2>
        {list.length === 0 && <div className="empty">Aucun check-in.</div>}
        {[...list].reverse().map((c) => (
          <div key={c.id} className="card stack-sm">
            <div className="row-between"><b>Semaine du {fmtShort(c.week_start)}</b><span className="tiny muted">envoyé {relativeDay(c.created_at)}</span></div>
            <div className="row wrap small">
              <span>Confiance <b>{c.confidence}</b></span><span>Stress <b>{c.stress}</b></span>
              <span>Concentration <b>{c.focus}</b></span><span>Motivation <b>{c.motivation}</b></span>
            </div>
            {c.mind && <div className="small" style={{ whiteSpace: "pre-wrap", background: "var(--creme)", padding: 10, borderRadius: 10 }}>« {c.mind} »</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Débriefs ---------- */
function Debriefs({ p }: { p: Profile }) {
  const nav = useNavigate();
  const [list, setList] = useState<Debrief[]>([]);
  const [fbs, setFbs] = useState<Feedback[]>([]);
  const load = useCallback(() => {
    supabase.from("debriefs").select("*").eq("rider_id", p.id).order("date", { ascending: false }).then(({ data }) => setList((data as Debrief[]) ?? []));
    supabase.from("competition_feedback").select("*").eq("rider_id", p.id).order("date", { ascending: false }).then(({ data }) => setFbs((data as Feedback[]) ?? []));
  }, [p.id]);
  const markFbRead = async (f: Feedback) => {
    await supabase.from("competition_feedback").update({ coach_read_at: new Date().toISOString() }).eq("id", f.id);
    load();
  };
  useEffect(load, [load]);
  const markRead = async (d: Debrief) => {
    await supabase.from("debriefs").update({ coach_read_at: new Date().toISOString() }).eq("id", d.id);
    load();
  };
  return (
    <div className="stack">
      {fbs.map((f) => (
        <div key={f.id} className="card card-lg stack">
          <FeedbackDetails f={f} p={p} />
          <div className="row wrap">
            {!f.coach_read_at && <button className="btn btn-sm" onClick={() => markFbRead(f)}>Marquer comme lu</button>}
            <button className="btn btn-sm btn-light" onClick={async () => { if (!f.coach_read_at) await markFbRead(f); nav(`/coach/cliente/${p.id}?onglet=messages`); }}>Lui répondre</button>
          </div>
        </div>
      ))}
      {list.length === 0 && <div className="empty">Aucun débrief pour l'instant.</div>}
      {list.map((d) => (
        <div key={d.id} className="card card-lg stack">
          <DebriefDetails d={d} showDate />
          <div className="row wrap">
            {!d.coach_read_at && <button className="btn btn-sm" onClick={() => markRead(d)}>Marquer comme lu</button>}
            <button className="btn btn-sm btn-light" onClick={async () => { if (!d.coach_read_at) await markRead(d); nav(`/coach/cliente/${p.id}?onglet=messages`); }}>Lui répondre</button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Objectifs ---------- */
function Objectifs({ p }: { p: Profile }) {
  const [list, setList] = useState<WeeklyGoals[]>([]);
  useEffect(() => {
    supabase.from("weekly_goals").select("*").eq("rider_id", p.id).order("week_start", { ascending: false }).limit(12).then(({ data }) => setList((data as WeeklyGoals[]) ?? []));
  }, [p.id]);
  return (
    <div className="cards">
      {list.length === 0 && <div className="empty">Pas encore d'objectifs notés.</div>}
      {list.map((w) => (
        <div key={w.id} className="card card-lg stack-sm">
          <b>Semaine du {fmtShort(w.week_start)}</b>
          {w.goals.length > 0 && <div className="small muted">Objectifs</div>}
          {w.goals.map((x, i) => <div key={i} className="small">{x.done ? "✅" : "⬜️"} {x.text}</div>)}
          {w.process_goals.length > 0 && <div className="small muted">Processus</div>}
          {w.process_goals.map((x, i) => <div key={i} className="small">{x.done ? "✅" : "⬜️"} {x.text}</div>)}
          {w.takeaway && <div className="small" style={{ background: "var(--creme)", padding: 10, borderRadius: 10 }}>Ce qu'elle retient : {w.takeaway}</div>}
        </div>
      ))}
    </div>
  );
}

/* ---------- Routine (modifiable) ---------- */
function RoutineEditor({ p, onSaved }: { p: Profile; onSaved: () => void }) {
  const [r, setR] = useState<Routine | null>(null);
  const [anchor, setAnchor] = useState(p.anchor_word ?? "");
  const [audios, setAudios] = useState<RoutineAudio[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadAudios = useCallback(() => {
    supabase.from("routine_audios").select("*").eq("rider_id", p.id).order("created_at").then(({ data }) => setAudios((data as RoutineAudio[]) ?? []));
  }, [p.id]);
  useEffect(() => {
    supabase.from("routines").select("*").eq("rider_id", p.id).maybeSingle().then(({ data }) =>
      setR((data as Routine) ?? { rider_id: p.id, steps: { avant: [], pendant: [], apres: [] }, checked: [], updated_at: "" }));
    loadAudios();
  }, [p.id, loadAudios]);

  if (!r) return <div className="loading">Chargement…</div>;

  const setStep = (ph: Phase, i: number, text: string) =>
    setR({ ...r, steps: { ...r.steps, [ph]: r.steps[ph].map((s, j) => (j === i ? { ...s, text } : s)) } });
  const addStep = (ph: Phase) => setR({ ...r, steps: { ...r.steps, [ph]: [...(r.steps[ph] ?? []), { id: newId(), text: "" }] } });
  const delStep = (ph: Phase, i: number) => setR({ ...r, steps: { ...r.steps, [ph]: r.steps[ph].filter((_, j) => j !== i) } });
  const move = (ph: Phase, i: number, d: number) => {
    const a = [...r.steps[ph]]; const j = i + d;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    setR({ ...r, steps: { ...r.steps, [ph]: a } });
  };

  async function save() {
    setBusy(true); setMsg(null);
    const steps = Object.fromEntries(PHASES.map((ph) => [ph.key, (r!.steps[ph.key] ?? []).filter((s) => s.text.trim())]));
    const { error } = await supabase.from("routines").upsert({ rider_id: p.id, steps, checked: r!.checked });
    await supabase.from("profiles").update({ anchor_word: anchor.trim() || null }).eq("id", p.id);
    setBusy(false);
    setMsg(error ? "Pas enregistré, réessaie." : "Routine enregistrée. Elle est à jour sur son téléphone.");
    onSaved();
  }

  async function addAudio(file: File) {
    const title = prompt("Titre de l'audio (ex. : Visualisation du parcours)", file.name.replace(/\.[^.]+$/, ""));
    if (!title) return;
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() ?? "m4a";
      const path = `${p.id}/${newId()}.${ext}`;
      await upload("audios", path, file);
      await supabase.from("routine_audios").insert({ rider_id: p.id, title, path });
      loadAudios();
    } catch { setMsg("L'audio n'a pas pu être envoyé (50 Mo maximum)."); }
    setBusy(false);
  }

  async function delAudio(a: RoutineAudio) {
    if (!confirm(`Supprimer « ${a.title} » ?`)) return;
    await supabase.storage.from("audios").remove([a.path]);
    await supabase.from("routine_audios").delete().eq("id", a.id);
    loadAudios();
  }

  return (
    <div className="stack-lg">
      <div className="field" style={{ maxWidth: 420 }}>
        <label htmlFor="anchor">Mot d'ancrage</label>
        <input id="anchor" className="input" placeholder="Ex. : Fluide" value={anchor} onChange={(e) => setAnchor(e.target.value)} />
      </div>
      <div className="two-col" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        {PHASES.map((ph) => (
          <div key={ph.key} className="card card-lg stack-sm">
            <h2 className="h2">{ph.label} le concours</h2>
            {(r.steps[ph.key] ?? []).map((s, i) => (
              <div key={s.id} className="row" style={{ gap: 4 }}>
                <input className="input grow" value={s.text} placeholder="Étape" aria-label={`Étape ${i + 1}`} onChange={(e) => setStep(ph.key, i, e.target.value)} />
                <button className="icon-btn" style={{ width: 36, height: 36 }} aria-label="Monter" onClick={() => move(ph.key, i, -1)}>↑</button>
                <button className="icon-btn" style={{ width: 36, height: 36 }} aria-label="Supprimer l'étape" onClick={() => delStep(ph.key, i)}><Icon name="close" size={14} /></button>
              </div>
            ))}
            <button className="btn btn-sm btn-light" style={{ alignSelf: "flex-start" }} onClick={() => addStep(ph.key)}><Icon name="plus" size={16} />Ajouter une étape</button>
          </div>
        ))}
      </div>
      {msg && <div className="success">{msg}</div>}
      <button className="btn" style={{ alignSelf: "flex-start" }} disabled={busy} onClick={save}>Enregistrer la routine</button>

      <section className="stack">
        <h2 className="h2">Audios de visualisation</h2>
        {audios.map((a) => (
          <div key={a.id} className="card row wrap">
            <div className="grow"><b>{a.title}</b><SignedAudio bucket="audios" path={a.path} /></div>
            <button className="btn btn-sm btn-danger" onClick={() => delAudio(a)}>Supprimer</button>
          </div>
        ))}
        <label className="btn btn-sm btn-light" style={{ alignSelf: "flex-start", cursor: "pointer" }}>
          <Icon name="plus" size={16} />Ajouter un audio
          <input type="file" accept="audio/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) addAudio(f); e.target.value = ""; }} />
        </label>
      </section>
    </div>
  );
}

/* ---------- Séances ---------- */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

function Seances({ p }: { p: Profile }) {
  const [list, setList] = useState<Session[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(() => {
    supabase.from("sessions").select("*").eq("rider_id", p.id).order("number", { nullsFirst: false }).order("scheduled_at").then(({ data }) => setList((data as Session[]) ?? []));
  }, [p.id]);
  useEffect(load, [load]);

  async function createStarter() {
    await supabase.from("sessions").insert(STARTER_SESSIONS.map((theme, i) => ({ rider_id: p.id, number: i + 1, theme })));
    load();
  }
  async function add() {
    const n = list.length + 1;
    await supabase.from("sessions").insert({ rider_id: p.id, number: n, theme: p.program === "levelup180" ? "Séance mensuelle" : p.program === "starter90" && n === 6 ? "Bilan" : "Séance" });
    load();
  }
  async function save(s: Session) {
    const { error } = await supabase.from("sessions").update({ theme: s.theme, scheduled_at: s.scheduled_at, visio_url: s.visio_url, prep: s.prep, done: s.done }).eq("id", s.id);
    if (!error && s.scheduled_at) {
      await supabase.from("appointment_requests").update({ status: "done" }).eq("rider_id", p.id).eq("status", "pending");
    }
    setMsg(error ? "Pas enregistré." : "Séance enregistrée.");
    setTimeout(() => setMsg(null), 2000);
    load();
  }
  async function del(s: Session) {
    if (!confirm("Supprimer cette séance ?")) return;
    await supabase.from("sessions").delete().eq("id", s.id);
    load();
  }

  return (
    <div className="stack">
      <div className="hint">Quand elle réserve depuis l'appli, la séance suivante se marque « Réservée » toute seule (avec la date si la clé Calendly est configurée). Tu peux toujours corriger une date ici.</div>
      {list.length === 0 && p.program === "starter90" && <button className="btn" style={{ alignSelf: "flex-start" }} onClick={createStarter}>Créer ses 5 séances Starter 90</button>}
      {msg && <div className="success">{msg}</div>}
      <div className="cards">
        {list.map((s) => <SessionCard key={s.id} s={s} onSave={save} onDelete={del} />)}
      </div>
      <button className="btn btn-sm btn-light" style={{ alignSelf: "flex-start" }} onClick={add}><Icon name="plus" size={16} />Ajouter une séance</button>
    </div>
  );
}

function SessionCard({ s, onSave, onDelete }: { s: Session; onSave: (s: Session) => void; onDelete: (s: Session) => void }) {
  const [f, setF] = useState(s);
  useEffect(() => setF(s), [s]);
  return (
    <div className="card card-lg stack-sm">
      <div className="row-between">
        <b>{s.number ? `Séance ${s.number}` : "Séance"}</b>
        {s.done ? <span className="tag tag-vert">Faite</span> : s.scheduled_at ? <span className="tag tag-gris">{fmtDateTime(s.scheduled_at)}</span> : s.booked_at ? <span className="tag tag-vert">Réservée sur Calendly</span> : <span className="tag tag-rose">À réserver</span>}
      </div>
      <input className="input" aria-label="Thème" value={f.theme} onChange={(e) => setF({ ...f, theme: e.target.value })} />
      <label className="small muted" htmlFor={`d-${s.id}`}>Date et heure</label>
      <input id={`d-${s.id}`} className="input" type="datetime-local" value={toLocalInput(f.scheduled_at)}
        onChange={(e) => setF({ ...f, scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
      <input className="input" aria-label="Lien de la visio" placeholder="Lien de la visio (facultatif)" value={f.visio_url ?? ""} onChange={(e) => setF({ ...f, visio_url: e.target.value || null })} />
      <textarea className="textarea" aria-label="À préparer" placeholder="Ce qu'elle doit préparer avant" value={f.prep ?? ""} onChange={(e) => setF({ ...f, prep: e.target.value || null })} />
      <label className="check"><input type="checkbox" checked={f.done} onChange={(e) => setF({ ...f, done: e.target.checked })} /><span>Séance faite</span></label>
      <div className="row">
        <button className="btn btn-sm" onClick={() => onSave(f)}>Enregistrer</button>
        <button className="btn btn-sm btn-ghost" onClick={() => onDelete(s)}>Supprimer</button>
      </div>
    </div>
  );
}

/* ---------- Notes privées ---------- */
function Notes({ p }: { p: Profile }) {
  const [list, setList] = useState<{ id: string; body: string; created_at: string }[]>([]);
  const [text, setText] = useState("");
  const load = useCallback(() => {
    supabase.from("coach_notes").select("*").eq("rider_id", p.id).order("created_at", { ascending: false }).then(({ data }) => setList(data ?? []));
  }, [p.id]);
  useEffect(load, [load]);
  async function add() {
    if (!text.trim()) return;
    await supabase.from("coach_notes").insert({ rider_id: p.id, body: text.trim() });
    setText("");
    load();
  }
  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <div className="hint">Invisibles pour {p.first_name}. Note ici ce qui ressort de chaque séance.</div>
      <textarea className="textarea" rows={4} aria-label="Nouvelle note" placeholder="Ce qui ressort de la séance…" value={text} onChange={(e) => setText(e.target.value)} />
      <button className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={add}>Ajouter la note</button>
      {list.map((n) => (
        <div key={n.id} className="card stack-sm">
          <div className="row-between"><span className="tiny muted">{fmtDate(n.created_at, { day: "numeric", month: "long", year: "numeric" })}</span>
            <button className="btn btn-ghost btn-sm" onClick={async () => { if (confirm("Supprimer cette note ?")) { await supabase.from("coach_notes").delete().eq("id", n.id); load(); } }}>Supprimer</button></div>
          <div style={{ whiteSpace: "pre-wrap" }}>{n.body}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Gestion ---------- */
function Gestion({ p, onSaved }: { p: Profile; onSaved: () => void }) {
  const nav = useNavigate();
  const { settings } = useMe();
  const [f, setF] = useState({
    first_name: p.first_name, last_name: p.last_name, gender: p.gender, program: p.program ?? "starter90",
    program_start: p.program_start ?? "", season_goal_progress: p.season_goal_progress, current_module: p.current_module ?? "",
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [deletion, setDeletion] = useState(false);

  useEffect(() => {
    supabase.from("deletion_requests").select("id").eq("rider_id", p.id).then(({ data }) => setDeletion((data ?? []).length > 0));
  }, [p.id]);

  async function save(patch: Partial<Profile>, ok = "Enregistré.") {
    setErr(null);
    const { error } = await supabase.from("profiles").update(patch).eq("id", p.id);
    if (error) return setErr(error.message);
    setMsg(ok); setTimeout(() => setMsg(null), 2500);
    onSaved();
  }

  async function newLink() {
    setErr(null);
    try {
      const r = await callFunction<{ link: string }>("coach-admin", { action: "link", rider_id: p.id });
      setLink(r.link);
    } catch (e) { setErr((e as Error).message); }
  }

  async function remove() {
    if (prompt(`Pour supprimer définitivement ${p.first_name} et toutes ses données, écris SUPPRIMER`) !== "SUPPRIMER") return;
    try {
      await callFunction("coach-admin", { action: "delete", rider_id: p.id });
      nav("/coach");
    } catch (e) { setErr((e as Error).message); }
  }

  const end = p.program_start && p.program !== "club" && p.program ? addDays(p.program_start, (settings?.program_weeks?.[p.program] ?? 12) * 7) : null;

  return (
    <div className="stack-lg" style={{ maxWidth: 760 }}>
      {msg && <div className="success">{msg}</div>}
      {err && <div className="error">{err}</div>}
      {deletion && (
        <div className="card-rose stack-sm">
          <b>{p.first_name} a demandé la suppression de son compte.</b>
          <div className="small">Tu as un mois maximum pour la traiter. La suppression est définitive.</div>
          <div className="row wrap">
            <button className="btn btn-sm btn-light" onClick={async () => {
              await supabase.from("deletion_requests").delete().eq("rider_id", p.id);
              setDeletion(false);
              setMsg(`Demande annulée : le compte de ${p.first_name} est conservé.`);
            }}>Annuler la demande (garder son compte)</button>
            <button className="btn btn-sm btn-danger" onClick={remove}>Supprimer définitivement</button>
          </div>
        </div>
      )}

      <section className="card card-lg stack">
        <h2 className="h2">Profil et programme</h2>
        <div className="row wrap">
          <div className="field grow"><label htmlFor="gfn">Prénom</label><input id="gfn" className="input" value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} /></div>
          <div className="field grow"><label htmlFor="gln">Nom</label><input id="gln" className="input" value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} /></div>
        </div>
        <div className="field"><span className="label">Textes de l'appli</span>
          <div className="pills"><button className="pill" aria-pressed={f.gender === "f"} onClick={() => setF({ ...f, gender: "f" })}>Cavalière</button>
            <button className="pill" aria-pressed={f.gender === "m"} onClick={() => setF({ ...f, gender: "m" })}>Cavalier</button></div></div>
        <div className="field"><span className="label">Programme</span>
          <div className="pills">{(["starter90", "levelup180", "club"] as const).map((k) => (
            <button key={k} className="pill" aria-pressed={f.program === k} onClick={() => setF({ ...f, program: k })}>{PROGRAM_LABEL[k]}</button>
          ))}</div></div>
        <div className="field" style={{ maxWidth: 260 }}><label htmlFor="gps">Date de début du programme</label>
          <input id="gps" className="input" type="date" value={f.program_start} onChange={(e) => setF({ ...f, program_start: e.target.value })} />
          {end && <span className="hint">Fin prévue : {fmtDate(end)}</span>}</div>
        <div className="field"><label htmlFor="gcm">Module de formation en cours (affiché sur son accueil)</label>
          <input id="gcm" className="input" placeholder="Ex. : Module 3 · Confiance en soi" value={f.current_module} onChange={(e) => setF({ ...f, current_module: e.target.value })} /></div>
        <div className="field"><label htmlFor="gsp">Avancée vers l'objectif de saison : {f.season_goal_progress} %</label>
          <input id="gsp" type="range" min={0} max={100} step={5} value={f.season_goal_progress} onChange={(e) => setF({ ...f, season_goal_progress: Number(e.target.value) })} /></div>
        <button className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => save({
          first_name: f.first_name.trim(), last_name: f.last_name.trim(), gender: f.gender, program: f.program,
          program_start: f.program_start || null, season_goal_progress: f.season_goal_progress, current_module: f.current_module.trim() || null,
        })}>Enregistrer</button>
      </section>

      <section className="card card-lg stack">
        <h2 className="h2">Connexion</h2>
        <div className="small muted">{p.email} · {p.activated_at ? `compte activé le ${fmtDate(p.activated_at, { day: "numeric", month: "long", year: "numeric" })}` : "invitation pas encore ouverte"}</div>
        <div className="small">Elle a perdu son mot de passe ou son invitation ? Crée un nouveau lien et envoie-le lui.</div>
        <button className="btn btn-sm btn-light" style={{ alignSelf: "flex-start" }} onClick={newLink}><Icon name="key" size={16} />Créer un nouveau lien de connexion</button>
        {link && <InviteLink link={link} firstName={p.first_name} email={p.email ?? ""} isNew={!p.activated_at} />}
      </section>

      <section className="card card-lg stack">
        <h2 className="h2">Statut</h2>
        <div className="small">
          <b>Active</b> : accès complet. <b>Ancienne cliente</b> : garde le groupe et voit son historique et sa routine, sans check-in ni messages automatiques.
          <b> Archivée</b> : plus aucun accès (ses données sont conservées).
        </div>
        <div className="pills">
          {([["active", "Active"], ["alumni", "Programme terminé (ancienne cliente)"], ["archived", "Archivée"]] as const).map(([k, l]) => (
            <button key={k} className="pill" aria-pressed={p.status === k} onClick={() => save({ status: k }, `Statut : ${l}.`)}>{l}</button>
          ))}
        </div>
      </section>

      <section className="card card-lg stack">
        <h2 className="h2">Supprimer définitivement</h2>
        <div className="small">Efface son compte, ses check-ins, débriefs, messages, photos et vocaux. Impossible à annuler.</div>
        <button className="btn btn-sm btn-danger" style={{ alignSelf: "flex-start" }} onClick={remove}><Icon name="trash" size={16} />Supprimer {p.first_name} et ses données</button>
      </section>
    </div>
  );
}

/* ---------- Bouton « Programme terminé » ---------- */
export function FinishButton({ p, onDone, small }: { p: Profile; onDone: () => void; small?: boolean }) {
  async function finish() {
    if (!confirm(`${p.first_name} a terminé son programme ?\n\nElle garde l'accès au groupe, à son historique et à sa routine, mais ne reçoit plus le check-in ni les messages automatiques.`)) return;
    await supabase.from("profiles").update({ status: "alumni" }).eq("id", p.id);
    onDone();
  }
  return (
    <button className={`btn ${small ? "btn-sm btn-light" : "btn-sm btn-light"}`} onClick={finish}>
      <Icon name="check" size={16} />Programme terminé
    </button>
  );
}

/* ---------- Indispensables personnels ---------- */
function PersonalEssentials({ p, onSaved }: { p: Profile; onSaved: () => void }) {
  const [rescue, setRescue] = useState(p.rescue_text ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  async function save() {
    const { error } = await supabase.from("profiles").update({ rescue_text: rescue.trim() || null }).eq("id", p.id);
    setMsg(error ? "Pas enregistré." : "Enregistré.");
    setTimeout(() => setMsg(null), 2000);
    onSaved();
  }
  return (
    <div className="stack-lg" style={{ maxWidth: 820 }}>
      <section className="card card-lg stack">
        <h2 className="h2">Sa boîte de secours personnelle</h2>
        <div className="hint">S'affiche au-dessus de la boîte de secours commune (page Indispensables du menu). Ex. : ses phrases clés, ce qui l'apaise, son plan B.</div>
        <textarea className="textarea" rows={6} aria-label="Boîte de secours personnelle" value={rescue} onChange={(e) => setRescue(e.target.value)} />
        {msg && <div className="success">{msg}</div>}
        <button className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={save}>Enregistrer</button>
      </section>
      <section className="stack">
        <h2 className="h2">Ses audios, fichiers et liens personnels</h2>
        <ResourceManager riderId={p.id} />
      </section>
    </div>
  );
}
