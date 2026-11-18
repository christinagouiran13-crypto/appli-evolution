import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useMe } from "../../lib/auth";
import { useTraining, type TrainingModule } from "../../lib/training";
import { BackHeader } from "../../components/BackHeader";
import { Icon } from "../../components/Icon";
import { Celebration } from "../../components/Celebration";
import { Parcours } from "../../components/Parcours";

export default function Formation() {
  const { me, settings } = useMe();
  const { modules, done, loaded, reload, current, week } = useTraining(me, settings);
  const [open, setOpen] = useState<string | null>(null);
  const [cele, setCele] = useState<string | null>(null);
  const active = me.status === "active";

  const openUrl = (m: TrainingModule) => m.url || settings?.training_url || "";

  async function finish(m: TrainingModule) {
    await supabase.from("training_progress").insert({ module_id: m.id });
    await reload();
    setCele(m.title);
  }
  async function undo(m: TrainingModule) {
    await supabase.from("training_progress").delete().eq("module_id", m.id).eq("rider_id", me.id);
    reload();
  }

  if (!loaded) return <div className="loading">Chargement…</div>;

  return (
    <div className="page">
      <BackHeader />
      <div className="stack-sm">
        <h1 className="h1">Ma formation</h1>
        {modules.length > 0 && (
          <>
            <div className="muted small">{done.size} module{done.size > 1 ? "s" : ""} terminé{done.size > 1 ? "s" : ""} sur {modules.length}</div>
            <div className="progress"><div style={{ width: `${Math.round((done.size / modules.length) * 100)}%` }} /></div>
          </>
        )}
      </div>

      {modules.length === 0 ? (
        <div className="stack">
          <div className="empty">Ta formation se trouve sur ta plateforme. Connecte-toi avec ton e-mail habituel.</div>
          {settings?.training_url && <a className="btn" href={settings.training_url} target="_blank" rel="noreferrer"><Icon name="external" size={18} />Ouvrir ma formation</a>}
        </div>
      ) : (
        <>
          <div className="hint">Les vidéos s'ouvrent sur ta plateforme de formation (Systemio). La première fois, connecte-toi avec ton e-mail habituel. Reviens ensuite ici pour cocher ce que tu as terminé.</div>
          <div className="stack-sm">
            {modules.map((m) => {
              const isDone = done.has(m.id);
              const isCurrent = current?.id === m.id;
              const later = !isDone && !isCurrent && (m.week_from ?? 0) > week;
              const expanded = open === m.id || (open === null && isCurrent);
              return (
                <div key={m.id} className={isCurrent ? "card-soft stack-sm" : "card stack-sm"} style={later ? { opacity: 0.75 } : undefined}>
                  <button className="card-link" style={{ border: "none", background: "none", padding: 0, textAlign: "left", font: "inherit", width: "100%", cursor: "pointer" }}
                    aria-expanded={expanded} onClick={() => setOpen(expanded ? "" : m.id)}>
                    <div className="icon-tile" style={isDone ? { background: "var(--vert)", color: "#fff" } : isCurrent ? { background: "#fff" } : undefined}>
                      <Icon name={isDone ? "check" : "play"} size={18} />
                    </div>
                    <div className="grow">
                      <div className="h3">{m.title}</div>
                      <div className="small muted">{m.weeks_label}{isCurrent ? " · ton module du moment" : isDone ? " · terminé" : ""}</div>
                    </div>
                    <Icon name={expanded ? "close" : "chevron"} size={16} />
                  </button>
                  {expanded && (
                    <div className="stack-sm">
                      <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
                        {m.lessons.map((l, i) => <li key={i}>{l}</li>)}
                      </ul>
                      <div className="row wrap">
                        <a className="btn btn-sm" href={openUrl(m)} target="_blank" rel="noreferrer"><Icon name="external" size={16} />Ouvrir le module</a>
                        {m.lessons.some((l) => /rdv|coaching/i.test(l)) && active && (
                          <Link className="btn btn-sm btn-light" to="/seances"><Icon name="calendar" size={16} />Réserver ma séance</Link>
                        )}
                        {active && (isDone
                          ? <button className="btn btn-sm btn-ghost" onClick={() => undo(m)}>Décocher</button>
                          : <button className="btn btn-sm btn-light" onClick={() => finish(m)}><Icon name="check" size={16} />J'ai terminé ce module</button>)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
      <Parcours progressLabel={modules.length ? `${done.size} module${done.size > 1 ? "s" : ""} terminé${done.size > 1 ? "s" : ""} sur ${modules.length}` : undefined} />

      {cele && (
        <Celebration title="Module validé !" onClose={() => setCele(null)}>
          <p style={{ margin: 0 }}>Bravo pour « {cele} ». Christina voit ta progression.</p>
        </Celebration>
      )}
    </div>
  );
}
