import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { fmtShort, programProgress, relativeDay } from "../../lib/dates";
import { useMe } from "../../lib/auth";
import { ALERT_LABEL, PROGRAM_LABEL } from "../../lib/text";
import type { Alert } from "../../lib/types";
import { useCoachData, type ClientRow } from "./useCoachData";
import { Avatar } from "../../components/Avatar";

const ACTION: Record<string, { label: string; tab: string }> = {
  confidence_drop: { label: "Lui écrire", tab: "messages" },
  stress_high: { label: "Lui écrire", tab: "messages" },
  dropout: { label: "La relancer", tab: "messages" },
  debrief_unread: { label: "Voir le débrief", tab: "debriefs" },
  message_waiting: { label: "Répondre", tab: "messages" },
  appointment: { label: "Noter la séance", tab: "seances" },
  program_end: { label: "Caler le bilan", tab: "seances" },
  deletion: { label: "Traiter la demande", tab: "gestion" },
};

type Filter = "all" | "todo" | "weekend" | "alumni" | "archived";

export default function Dashboard() {
  const { me, settings } = useMe();
  const nav = useNavigate();
  const { rows, alerts, loading, reload, kpis, weekend } = useCoachData();
  const [filter, setFilter] = useState<Filter>("all");

  async function dismiss(a: Alert) {
    await supabase.from("alert_dismissals").insert({ rider_id: a.rider_id, kind: a.kind, ref_key: a.ref_key });
    if (a.kind === "debrief_unread") await supabase.from("debriefs").update({ coach_read_at: new Date().toISOString() }).eq("id", a.ref_key);
    if (a.kind === "appointment") await supabase.from("appointment_requests").update({ status: "done" }).eq("id", a.ref_key);
    reload();
  }

  const byId = new Map(rows.map((r) => [r.id, r]));
  const shown = rows.filter((r) => {
    if (filter === "archived") return r.status === "archived";
    if (filter === "alumni") return r.status === "alumni";
    if (r.status !== "active") return false;
    if (filter === "todo") return r.alerts.length > 0;
    if (filter === "weekend") return !!r.nextComp && r.nextComp.date >= weekend.from && r.nextComp.date <= weekend.to;
    return true;
  });

  if (loading) return <div className="loading">Chargement…</div>;

  return (
    <>
      <div className="stack-sm">
        <div className="eyebrow">Bonjour {me.first_name}</div>
        <h1 className="h1" style={{ fontSize: 36 }}>Qui a besoin de toi cette semaine</h1>
      </div>

      <div className="kpis">
        <Kpi label="Clientes actives" value={kpis.active} note="Tous programmes confondus" />
        <Kpi label="Check-ins reçus" value={`${kpis.checkins} / ${kpis.active}`} note="Cette semaine" />
        <Kpi label="Concours ce week-end" value={kpis.weekend} note={`Du ${fmtShort(weekend.from)} au ${fmtShort(weekend.to)}`} />
        <Kpi label="À traiter" value={kpis.todo} note={kpis.todo ? "Détail ci-dessous" : "Tout va bien"} />
      </div>

      <section className="stack">
        <h2 className="h2" style={{ fontSize: 20 }}>À traiter en priorité</h2>
        {alerts.length === 0 && <div className="empty">Rien à traiter : toutes tes clientes vont bien. Profite !</div>}
        <div className="cards">
          {alerts.map((a) => {
            const r = byId.get(a.rider_id);
            const act = ACTION[a.kind] ?? { label: "Ouvrir la fiche", tab: "suivi" };
            return (
              <div key={`${a.kind}-${a.ref_key}`} className="card card-lg stack-sm">
                <div className="row-between">
                  <div className="row"><Avatar path={r?.avatar_path} name={r?.first_name ?? "?"} size={32} /><span className="bold">{r?.first_name} {r?.last_name?.slice(0, 1)}{r?.last_name ? "." : ""}</span></div>
                  <span className={`tag ${a.kind === "message_waiting" || a.kind === "appointment" ? "tag-vert" : "tag-rose"}`}>{ALERT_LABEL[a.kind] ?? a.kind}</span>
                </div>
                <div className="small" style={{ color: "#3D524B" }}>{a.detail}</div>
                <div className="tiny muted">{relativeDay(a.created_at)}</div>
                <div className="row wrap">
                  <button className="btn btn-sm" onClick={() => nav(`/coach/cliente/${a.rider_id}?onglet=${act.tab}`)}>{act.label}</button>
                  {a.kind !== "deletion" && <button className="btn btn-sm btn-light" onClick={() => dismiss(a)}>C'est fait</button>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="stack">
        <div className="row-between wrap">
          <h2 className="h2" style={{ fontSize: 20 }}>Toutes les clientes</h2>
          <div className="pills" role="group" aria-label="Filtrer les clientes">
            {([["all", "Toutes"], ["todo", "À traiter"], ["weekend", "Concours ce week-end"], ["alumni", "Anciennes"], ["archived", "Archivées"]] as [Filter, string][]).map(([k, l]) => (
              <button key={k} className="pill" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
            ))}
          </div>
        </div>
        {rows.length === 0 ? (
          <div className="empty">Aucune cliente pour l'instant. <Link to="/coach/inviter">Invite ta première cliente</Link>.</div>
        ) : (
          <div className="table-box">
            <table className="list">
              <thead><tr><th>Cliente</th><th>Programme</th><th>Avancée</th><th>Dernier check-in</th><th>Confiance</th><th>Prochain concours</th></tr></thead>
              <tbody>
                {shown.map((r) => <Row key={r.id} r={r} onOpen={() => nav(`/coach/cliente/${r.id}`)} settings={settings} />)}
                {shown.length === 0 && <tr><td colSpan={6} className="muted">Aucune cliente dans ce filtre.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function Kpi({ label, value, note }: { label: string; value: number | string; note: string }) {
  return <div className="kpi"><div className="small muted" style={{ fontWeight: 500 }}>{label}</div><div className="v">{value}</div><div className="small muted">{note}</div></div>;
}

function Row({ r, onOpen, settings }: { r: ClientRow; onOpen: () => void; settings: ReturnType<typeof useMe>["settings"] }) {
  const prog = programProgress(r, settings);
  const t = r.trend;
  return (
    <tr className="clickable" onClick={onOpen} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen()}>
      <td>
        <div className="row"><Avatar path={r.avatar_path} name={r.first_name} size={30} />
          <div><Link to={`/coach/cliente/${r.id}`} className="bold" style={{ color: "inherit", textDecoration: "none" }} onClick={(e) => e.stopPropagation()}>{r.first_name} {r.last_name}</Link>
            {r.alerts.length > 0 && <div className="tiny" style={{ color: "var(--rose-texte)" }}>{r.alerts.map((a) => ALERT_LABEL[a.kind]).join(" · ")}</div>}
            {!r.activated_at && <div className="tiny muted">Invitation pas encore ouverte</div>}
          </div></div>
      </td>
      <td>{r.program ? PROGRAM_LABEL[r.program] : "—"}</td>
      <td className="muted">{r.status === "alumni" ? "Ancienne cliente" : r.status === "archived" ? "Archivée" : prog?.label ?? (r.program === "club" ? "Abonnée" : "—")}</td>
      <td className="muted">{r.lastCheckin ? relativeDay(r.lastCheckin.created_at) : "Aucun"}</td>
      <td>
        {!t && r.lastCheckin && <span className="bold">{r.lastCheckin.confidence} </span>}
        {!t && !r.lastCheckin && <span className="muted">Pas encore de données</span>}
        {t && t.to < t.from && <span className="tag tag-rose">{t.from} → {t.to} en baisse</span>}
        {t && t.to > t.from && <span className="tag tag-vert">{t.from} → {t.to} en hausse</span>}
        {t && t.to === t.from && <span className="bold">{t.to} stable</span>}
      </td>
      <td className="muted">{r.nextComp ? `${fmtShort(r.nextComp.date)}${r.nextComp.location ? ` · ${r.nextComp.location}` : ""}` : "—"}</td>
    </tr>
  );
}
