import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useMe } from "../../lib/auth";
import { fmtDate, fmtShort, todayISO } from "../../lib/dates";
import { resultLabel } from "../../lib/text";
import type { Competition, Debrief } from "../../lib/types";
import { Icon } from "../../components/Icon";
import { Modal } from "../../components/Modal";
import { UrgentButton } from "../../components/UrgentButton";

type CompRow = Competition & { debriefs: { id: string }[] };

export default function Competitions() {
  const { me } = useMe();
  const [comps, setComps] = useState<CompRow[]>([]);
  const [debriefs, setDebriefs] = useState<Debrief[]>([]);
  const [adding, setAdding] = useState<Competition | null | "new">(null);
  const active = me.status === "active";
  const today = todayISO();

  const load = async () => {
    const [c, d] = await Promise.all([
      supabase.from("competitions").select("*, debriefs(id)").eq("rider_id", me.id).order("date"),
      supabase.from("debriefs").select("*").eq("rider_id", me.id).order("date", { ascending: false }),
    ]);
    setComps((c.data as CompRow[]) ?? []);
    setDebriefs((d.data as Debrief[]) ?? []);
  };
  useEffect(() => { load(); }, [me.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const upcoming = comps.filter((c) => c.date >= today);
  const toDebrief = comps.filter((c) => c.date < today && c.debriefs.length === 0).reverse().slice(0, 5);

  return (
    <div className="page">
      <div className="row-between"><h1 className="h1">Concours</h1><UrgentButton /></div>

      {active && (
        <div className="row wrap">
          <button className="btn btn-sm" onClick={() => setAdding("new")}><Icon name="plus" size={18} />Ajouter un concours</button>
          <Link className="btn btn-sm btn-light" to="/concours/debrief?type=cours">Débrief après un cours</Link>
        </div>
      )}

      {toDebrief.length > 0 && active && (
        <section className="stack">
          <h2 className="h2">Débriefs à faire</h2>
          {toDebrief.map((c) => (
            <Link key={c.id} to={`/concours/debrief?concours=${c.id}`} className="card card-link">
              <div className="icon-tile" style={{ background: "var(--rose)", color: "var(--rose-texte)" }}><Icon name="flag" size={20} /></div>
              <div className="grow"><div className="h3">{c.event || "Concours"}{c.location ? ` · ${c.location}` : ""}</div><div className="small muted">{fmtDate(c.date)} · 5 minutes</div></div>
              <span className="tag tag-rose">À faire</span>
            </Link>
          ))}
          <Link to="/concours/feedback" className="small" style={{ alignSelf: "flex-start" }}>Remplir le questionnaire de feedback</Link>
        </section>
      )}

      <section className="stack">
        <h2 className="h2">Mon calendrier</h2>
        {upcoming.length === 0 && <div className="empty">Aucun concours prévu. Ajoute ton prochain pour recevoir un petit mot la veille.</div>}
        {upcoming.map((c) => (
          <button key={c.id} className="card card-link" style={{ textAlign: "left", cursor: active ? "pointer" : "default" }} onClick={() => active && setAdding(c)}>
            <div className="icon-tile"><Icon name="calendar" size={20} /></div>
            <div className="grow">
              <div className="h3">{fmtDate(c.date)}</div>
              <div className="small muted">{[c.location, c.event, c.height].filter(Boolean).join(" · ") || "Concours"}</div>
            </div>
            {active && <Icon name="edit" size={18} />}
          </button>
        ))}
      </section>

      <section className="stack">
        <h2 className="h2">Mes débriefs</h2>
        {debriefs.length === 0 && <div className="empty">Tes débriefs apparaîtront ici, pour voir ta progression.</div>}
        {debriefs.map((d) => (
          <Link key={d.id} to={`/concours/debrief/${d.id}`} className="card card-link">
            <div className="icon-tile"><Icon name={d.kind === "cours" ? "book" : "trophy"} size={20} /></div>
            <div className="grow">
              <div className="h3">{d.title || (d.kind === "cours" ? "Cours" : "Concours")}</div>
              <div className="small muted">{fmtShort(d.date)}{d.kind === "concours" ? ` · ${resultLabel(d.result)}` : " · après un cours"}</div>
            </div>
            {d.coach_read_at ? <span className="tag tag-vert">Lu par Christina</span> : <Icon name="chevron" size={18} />}
          </Link>
        ))}
      </section>

      {adding && <CompetitionForm comp={adding === "new" ? null : adding} onClose={() => setAdding(null)} onSaved={() => { setAdding(null); load(); }} />}
    </div>
  );
}

function CompetitionForm({ comp, onClose, onSaved }: { comp: Competition | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ date: comp?.date ?? todayISO(), location: comp?.location ?? "", event: comp?.event ?? "", height: comp?.height ?? "" });
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    if (!f.date) return setErr("Indique la date.");
    const { error } = comp
      ? await supabase.from("competitions").update(f).eq("id", comp.id)
      : await supabase.from("competitions").insert(f);
    if (error) return setErr("Impossible d'enregistrer. Réessaie.");
    onSaved();
  };
  const remove = async () => {
    if (!comp || !confirm("Supprimer ce concours ?")) return;
    await supabase.from("competitions").delete().eq("id", comp.id);
    onSaved();
  };
  return (
    <Modal title={comp ? "Modifier le concours" : "Nouveau concours"} onClose={onClose}>
      <div className="field"><label htmlFor="cd">Date</label><input id="cd" className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
      <div className="field"><label htmlFor="cl">Lieu</label><input id="cl" className="input" placeholder="Ex. : Fontainebleau" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></div>
      <div className="field"><label htmlFor="ce">Épreuve</label><input id="ce" className="input" placeholder="Ex. : Amateur 2 Grand Prix" value={f.event} onChange={(e) => setF({ ...f, event: e.target.value })} /></div>
      <div className="field"><label htmlFor="ch">Hauteur</label><input id="ch" className="input" placeholder="Ex. : 1,10 m" value={f.height} onChange={(e) => setF({ ...f, height: e.target.value })} /></div>
      {err && <div className="error">{err}</div>}
      <button className="btn btn-block" onClick={save}>Enregistrer</button>
      {comp && <button className="btn btn-danger" onClick={remove}>Supprimer ce concours</button>}
    </Modal>
  );
}
