import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useMe } from "../../lib/auth";
import type { Feedback, RoutineAudio } from "../../lib/types";
import { fmtShort } from "../../lib/dates";
import { Icon } from "../../components/Icon";
import { SignedAudio } from "../../components/Media";
import { ResourceCard, useResources } from "../../components/Resources";
import { UrgentButton } from "../../components/UrgentButton";

// « Les indispensables » : boîte de secours, routine, audios, feedback, fichiers
export default function Essentials() {
  const { me, settings, refresh } = useMe();
  const { list } = useResources("mine");
  const [audios, setAudios] = useState<RoutineAudio[]>([]);
  const [showRescue, setShowRescue] = useState(false);
  const [myFeedback, setMyFeedback] = useState<Feedback[]>([]);

  useEffect(() => {
    refresh();
    supabase.from("competition_feedback").select("*").eq("rider_id", me.id).order("date", { ascending: false }).then(({ data }) => setMyFeedback((data as Feedback[]) ?? []));
    supabase.from("routine_audios").select("*").eq("rider_id", me.id).order("created_at").then(({ data }) => setAudios((data as RoutineAudio[]) ?? []));
  }, [me.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const feedback = list.filter((r) => r.category === "feedback");
  const audioRes = list.filter((r) => r.category === "audio");
  const files = list.filter((r) => r.category === "fichier" || r.category === "lien");
  const rescue = [me.rescue_text, settings?.rescue_text].filter(Boolean).join("\n\n");

  return (
    <div className="page">
      <div className="stack-sm">
        <h1 className="h1">Mes indispensables</h1>
        <p className="muted" style={{ margin: 0 }}>Tout ce qu'il te faut pour tes concours, au même endroit.</p>
      </div>

      <UrgentButton block />

      <section className="stack">
        <button className="card-soft card-link" style={{ border: "none", textAlign: "left", width: "100%", cursor: "pointer", font: "inherit" }} onClick={() => setShowRescue(!showRescue)} aria-expanded={showRescue}>
          <div className="icon-tile" style={{ background: "#fff" }}><Icon name="heart" size={20} /></div>
          <div className="grow"><div className="h3">Ma boîte de secours</div><div className="small muted">Quand le stress monte, ouvre-la.</div></div>
          <Icon name={showRescue ? "close" : "chevron"} size={18} />
        </button>
        {showRescue && <div className="rescue">{rescue || "Christina prépare ta boîte de secours."}</div>}
      </section>

      <Link to="/routine" className="card card-link">
        <div className="icon-tile"><Icon name="list" size={20} /></div>
        <div className="grow"><div className="h3">Ma routine</div><div className="small muted">Avant, pendant, après le concours. Construis-la et coche-la.</div></div>
        <Icon name="chevron" size={18} />
      </Link>

      {(audios.length > 0 || audioRes.length > 0) && (
        <section className="stack">
          <h2 className="h2">Audios de préparation mentale</h2>
          {audios.map((a) => (
            <div key={a.id} className="card stack-sm"><div className="h3">{a.title}</div><SignedAudio bucket="audios" path={a.path} /></div>
          ))}
          {audioRes.map((r) => <ResourceCard key={r.id} r={r} />)}
        </section>
      )}

      <section className="stack">
        <h2 className="h2">Questionnaire de feedback</h2>
        {me.status === "active" && (
          <Link to="/concours/feedback" className="card card-link">
            <div className="icon-tile"><Icon name="edit" size={20} /></div>
            <div className="grow"><div className="h3">Remplir mon feedback après concours</div><div className="small muted">7 questions pour faire le point avec Christina</div></div>
            <Icon name="chevron" size={18} />
          </Link>
        )}
        {myFeedback.map((f) => (
          <Link key={f.id} to={`/concours/feedback/${f.id}`} className="card card-link">
            <div className="grow"><div className="h3">{f.title || "Concours"}</div><div className="small muted">{fmtShort(f.date)}</div></div>
            {f.coach_read_at ? <span className="tag tag-vert">Lu par Christina</span> : <Icon name="chevron" size={18} />}
          </Link>
        ))}
        {feedback.map((r) => <ResourceCard key={r.id} r={r} />)}
      </section>

      {files.length > 0 && (
        <section className="stack">
          <h2 className="h2">Fichiers et liens</h2>
          {files.map((r) => <ResourceCard key={r.id} r={r} />)}
        </section>
      )}
    </div>
  );
}
