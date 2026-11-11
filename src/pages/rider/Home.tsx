import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useMe } from "../../lib/auth";
import { currentWeek, daysBetween, fmtDate, fmtDateTime, programProgress, relativeDay, todayISO, addDays } from "../../lib/dates";
import { computeStreak } from "../../lib/streak";
import { PROGRAM_LABEL, g } from "../../lib/text";
import type { Competition, Message, Session } from "../../lib/types";
import { Icon } from "../../components/Icon";
import logo from "../../components/logo-vert.svg";
import { InstallHint } from "../../components/InstallHint";
import { UrgentButton } from "../../components/UrgentButton";

type Data = {
  nextComp: Competition | null;
  checkinDone: boolean;
  goalsDone: boolean;
  debriefTodo: Competition | null;
  lastCoachMsg: Message | null;
  nextSession: Session | null;
  weeks: string[];
};

export default function Home() {
  const { me, settings } = useMe();
  const [d, setD] = useState<Data | null>(null);
  const active = me.status === "active";

  useEffect(() => {
    (async () => {
      const today = todayISO();
      const week = currentWeek();
      const [comps, past, checkins, goals, msg, sess] = await Promise.all([
        supabase.from("competitions").select("*").gte("date", today).order("date").limit(1),
        supabase.from("competitions").select("*, debriefs(id)").lt("date", today).gte("date", addDays(today, -10)).order("date", { ascending: false }),
        supabase.from("checkins").select("week_start").eq("rider_id", me.id).order("week_start", { ascending: false }).limit(60),
        supabase.from("weekly_goals").select("id, goals").eq("rider_id", me.id).eq("week_start", week).maybeSingle(),
        supabase.from("messages").select("*").eq("thread_rider_id", me.id).neq("sender_id", me.id).order("created_at", { ascending: false }).limit(1),
        supabase.from("sessions").select("*").eq("rider_id", me.id).eq("done", false).gte("scheduled_at", new Date().toISOString()).order("scheduled_at").limit(1),
      ]);
      const weeks = (checkins.data ?? []).map((c) => c.week_start as string);
      const todo = ((past.data ?? []) as (Competition & { debriefs: { id: string }[] })[]).find((c) => c.debriefs.length === 0) ?? null;
      setD({
        nextComp: (comps.data?.[0] as Competition) ?? null,
        checkinDone: weeks.includes(week),
        goalsDone: ((goals.data?.goals as unknown[]) ?? []).length > 0,
        debriefTodo: todo,
        lastCoachMsg: (msg.data?.[0] as Message) ?? null,
        nextSession: (sess.data?.[0] as Session) ?? null,
        weeks,
      });
    })();
  }, [me.id]);

  const prog = programProgress(me, settings);
  const streak = d ? computeStreak(d.weeks) : null;

  return (
    <div className="page">
      <div className="topbar">
        <div className="brand"><img src={logo} alt="" />Évolution</div>
        <div className="row" style={{ gap: 8 }}>
          <UrgentButton />
          <Link to="/profil" className="icon-btn" aria-label="Mon profil"><Icon name="user" size={20} /></Link>
        </div>
      </div>

      <div className="stack-sm">
        <h1 className="h1" style={{ fontSize: 32 }}>Bonjour {me.first_name}</h1>
        {me.status === "alumni" ? (
          <div className="muted">Ancienne {g(me, "cliente", "client")} Évolution · ton historique reste à toi</div>
        ) : prog ? (
          <>
            <div className="muted">{prog.label} · {PROGRAM_LABEL[me.program!]}</div>
            <div className="progress" style={{ marginTop: 6 }} role="progressbar" aria-valuenow={prog.pct} aria-valuemin={0} aria-valuemax={100}>
              <div style={{ width: `${prog.pct}%` }} />
            </div>
          </>
        ) : me.program ? <div className="muted">{PROGRAM_LABEL[me.program]}</div> : null}
      </div>

      <InstallHint />

      {d?.nextComp && (
        <div className="card-rose stack">
          <div className="eyebrow rose">Prochain concours</div>
          <div className="serif" style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.2 }}>
            {[d.nextComp.event, d.nextComp.location].filter(Boolean).join(" · ") || "Concours"} · {fmtDate(d.nextComp.date)}
          </div>
          <div style={{ color: "#4A3330" }}>
            {(() => {
              const n = daysBetween(todayISO(), d.nextComp.date);
              return n === 0 ? "C'est aujourd'hui ! Ta routine est prête." : n === 1 ? "C'est demain ! Relis ta routine ce soir." : `Dans ${n} jours. Ta routine d'avant-concours t'attend.`;
            })()}
          </div>
          <Link to="/routine" className="btn btn-sm" style={{ alignSelf: "flex-start" }}>Voir ma routine</Link>
        </div>
      )}

      {active && (
        <div className="stack">
          <h2 className="h2">Cette semaine</h2>
          <TaskLink to="/checkin" icon="pulse" title="Check-in de la semaine" sub="2 minutes" done={d?.checkinDone} />
          <TaskLink to="/objectifs" icon="target" title="Mes objectifs de la semaine" sub="Objectifs et processus" done={d?.goalsDone} />
          {d?.debriefTodo && (
            <TaskLink to={`/concours/debrief?concours=${d.debriefTodo.id}`} icon="flag"
              title={`Débrief du concours ${relativeDay(d.debriefTodo.date + "T12:00:00")}`} sub="5 minutes" done={false} />
          )}
          {me.current_module && (
            <a href={settings?.training_url} target="_blank" rel="noreferrer" className="card card-link">
              <div className="icon-tile"><Icon name="play" size={20} /></div>
              <div className="grow"><div className="h3">{me.current_module}</div><div className="small muted">Sur ta plateforme de formation</div></div>
              <Icon name="external" size={18} />
            </a>
          )}
        </div>
      )}

      {streak && streak.count > 0 && (
        <Link to="/progression" className="card card-link">
          <span className="flame" style={{ color: streak.paused ? "#9AA9A3" : "#E07A5F", transform: `scale(${Math.min(1.6, 1 + streak.count * 0.06)})` }}>
            <Icon name="flame" size={26} />
          </span>
          <div className="grow">
            <div className="h3">{streak.count} semaine{streak.count > 1 ? "s" : ""} de check-in{streak.paused ? " · en pause" : ""}</div>
            <div className="small muted">{streak.paused ? "Fais ton check-in pour relancer ta série." : "Voir ma progression et mes badges"}</div>
          </div>
          <Icon name="chevron" size={18} />
        </Link>
      )}
      {streak && streak.count === 0 && (
        <Link to="/progression" className="card card-link">
          <div className="icon-tile"><Icon name="star" size={20} /></div>
          <div className="grow"><div className="h3">Ma progression</div><div className="small muted">Courbe de confiance, série et badges</div></div>
          <Icon name="chevron" size={18} />
        </Link>
      )}

      {d && (d.lastCoachMsg || d.nextSession) && (
        <Link to="/messages?fil=coach" className="card-soft stack-sm" style={{ textDecoration: "none", color: "inherit" }}>
          {d.lastCoachMsg && (
            <>
              <div className="small bold" style={{ color: "var(--vert)" }}>Message de Christina · {relativeDay(d.lastCoachMsg.created_at)}</div>
              <div style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {d.lastCoachMsg.body ?? (d.lastCoachMsg.audio_path ? "Message vocal" : "Photo")}
              </div>
            </>
          )}
          {d.nextSession && (
            <div className="small bold" style={{ color: "var(--vert)" }}>Prochaine séance : {fmtDateTime(d.nextSession.scheduled_at)}</div>
          )}
        </Link>
      )}

      <Link to="/seances" className="card card-link">
        <div className="icon-tile"><Icon name="calendar" size={20} /></div>
        <div className="grow"><div className="h3">Mes séances</div><div className="small muted">Rendez-vous et préparation</div></div>
        <Icon name="chevron" size={18} />
      </Link>
    </div>
  );
}

function TaskLink({ to, icon, title, sub, done }: { to: string; icon: string; title: string; sub: string; done?: boolean }) {
  return (
    <Link to={to} className="card card-link">
      <div className="icon-tile"><Icon name={icon} size={20} /></div>
      <div className="grow"><div className="h3">{title}</div><div className="small muted">{sub}</div></div>
      {done === undefined ? null : done
        ? <span className="tag tag-vert">Fait</span>
        : <span className="tag tag-rose">À faire</span>}
    </Link>
  );
}
