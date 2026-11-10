import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useMe } from "../../lib/auth";
import { fmtShort } from "../../lib/dates";
import { computeStreak } from "../../lib/streak";
import { BADGES, badgeName } from "../../lib/text";
import type { Checkin } from "../../lib/types";
import { BackHeader } from "../../components/BackHeader";
import { Icon } from "../../components/Icon";
import { LineChart } from "../../components/LineChart";
import { ShareVictory } from "../../components/ShareVictory";
import { Celebration } from "../../components/Celebration";

export default function Progress() {
  const { me, settings, refresh } = useMe();
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [badges, setBadges] = useState<Record<string, string>>({});
  const [share, setShare] = useState(false);
  const [moduleDone, setModuleDone] = useState(false);

  const load = () => {
    supabase.from("checkins").select("*").eq("rider_id", me.id).order("week_start").then(({ data }) => setCheckins((data as Checkin[]) ?? []));
    supabase.from("badges").select("code, earned_at").eq("rider_id", me.id).then(({ data }) =>
      setBadges(Object.fromEntries((data ?? []).map((b) => [b.code, b.earned_at]))));
  };
  useEffect(load, [me.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const streak = computeStreak(checkins.map((c) => c.week_start));
  const last = checkins.slice(-12);

  async function finishModule() {
    if (!confirm(`Tu as terminé « ${me.current_module} » ?`)) return;
    await supabase.rpc("complete_module");
    await refresh();
    load();
    setModuleDone(true);
  }

  return (
    <div className="page">
      <BackHeader />
      <h1 className="h1">Ma progression</h1>

      <div className="card card-lg row">
        <span className="flame" style={{ color: streak.paused || streak.count === 0 ? "#9AA9A3" : "#E07A5F", transform: `scale(${Math.min(1.8, 1 + streak.count * 0.07)})`, margin: "0 8px" }}>
          <Icon name="flame" size={34} />
        </span>
        <div className="grow">
          <div className="serif" style={{ fontSize: 24, fontWeight: 500 }}>
            {streak.count === 0 ? "Ta série commence ici" : `${streak.count} semaine${streak.count > 1 ? "s" : ""} d'affilée`}
          </div>
          <div className="small muted">
            {streak.paused ? "Ta série est en pause : une semaine manquée ne remet pas tout à zéro." : streak.doneThisWeek ? "Check-in de la semaine fait. Bravo !" : "Fais ton check-in de la semaine pour l'allumer."}
          </div>
        </div>
      </div>

      {me.season_goal && (
        <section className="card stack-sm">
          <div className="eyebrow">Objectif de saison</div>
          <div className="h3">{me.season_goal}</div>
          <div className="progress" role="progressbar" aria-valuenow={me.season_goal_progress} aria-valuemin={0} aria-valuemax={100}>
            <div style={{ width: `${me.season_goal_progress}%` }} />
          </div>
          <div className="small muted">{me.season_goal_progress} % du chemin, d'après ton point avec Christina</div>
        </section>
      )}

      <section className="card stack">
        <h2 className="h2">Ma confiance, semaine après semaine</h2>
        {last.length < 2 ? (
          <div className="small muted">Ta courbe apparaît après deux check-ins.</div>
        ) : (
          <LineChart labels={last.map((c) => fmtShort(c.week_start))} series={[
            { label: "Confiance", color: "#2F5D50", values: last.map((c) => c.confidence) },
            { label: "Motivation", color: "#C9A13B", values: last.map((c) => c.motivation) },
          ]} />
        )}
      </section>

      <section className="stack">
        <h2 className="h2">Mes badges</h2>
        <div className="badges">
          {BADGES.map((b) => (
            <div key={b.code} className={`badge ${badges[b.code] ? "" : "locked"}`} title={b.how}>
              <div className="medal"><Icon name={b.icon} size={24} /></div>
              <div className="name">{badgeName(b, me)}</div>
              <div className="tiny muted">{badges[b.code] ? fmtShort(badges[b.code]) : b.how}</div>
            </div>
          ))}
        </div>
      </section>

      {me.status === "active" && (
        <div className="stack">
          <button className="btn btn-block" onClick={() => setShare(true)}><Icon name="trophy" size={20} />Partager une victoire au groupe</button>
          {me.current_module && (
            <>
              <a className="btn btn-light btn-block" href={settings?.training_url} target="_blank" rel="noreferrer"><Icon name="play" size={20} />Ma formation : {me.current_module}</a>
              <button className="btn btn-ghost" onClick={finishModule}>J'ai terminé ce module</button>
            </>
          )}
        </div>
      )}

      {share && <ShareVictory onClose={() => setShare(false)} />}
      {moduleDone && (
        <Celebration title="Module validé !" onClose={() => setModuleDone(false)}>
          <p style={{ margin: 0 }}>Bravo, Christina va voir ta progression. Elle t'indiquera le prochain module.</p>
        </Celebration>
      )}
    </div>
  );
}
