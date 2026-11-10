import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { compressImage, upload } from "../../lib/storage";
import { currentPushState, disablePush, enablePush, isIOS, isStandalone } from "../../lib/push";
import { PROGRAM_LABEL, g } from "../../lib/text";
import { fmtDate } from "../../lib/dates";
import type { Profile as P } from "../../lib/types";
import { BackHeader } from "../../components/BackHeader";
import { Avatar } from "../../components/Avatar";
import { Icon } from "../../components/Icon";

const DISCIPLINES = ["CSO", "CCE", "Dressage", "Autre"];

export default function Profile() {
  const { profile, refresh, signOut } = useAuth();
  const me = profile!;
  const [f, setF] = useState({
    first_name: me.first_name, discipline: me.discipline ?? "", level: me.level ?? "",
    horse_name: me.horse_name ?? "", season_goal: me.season_goal ?? "",
  });
  const [prefs, setPrefs] = useState(me.notif_prefs);
  const [saved, setSaved] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [push, setPush] = useState<string>("unknown");
  const [deletion, setDeletion] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    currentPushState().then(setPush);
    supabase.from("deletion_requests").select("id").eq("rider_id", me.id).then(({ data }) => setDeletion((data ?? []).length > 0));
  }, [me.id]);

  async function save(patch: Partial<P>) {
    setErr(null);
    const { error } = await supabase.from("profiles").update(patch).eq("id", me.id);
    if (error) { setErr("Pas enregistré. Réessaie."); return; }
    setSaved("Enregistré");
    setTimeout(() => setSaved(null), 2000);
    refresh();
  }

  async function changePhoto(file: File) {
    const blob = await compressImage(file, 600);
    const path = `${me.id}/photo-${Date.now()}.jpg`;
    await upload("avatars", path, blob, "image/jpeg");
    await save({ avatar_path: path });
  }

  async function togglePush() {
    setErr(null);
    try {
      if (push === "on") { await disablePush(); setPush("off"); }
      else { await enablePush(); setPush("on"); }
    } catch (e) { setErr((e as Error).message); }
  }

  async function requestDeletion() {
    if (!confirm("Tu demandes la suppression définitive de ton compte et de toutes tes données (check-ins, débriefs, messages, photos). Christina s'en occupe sous un mois maximum. Continuer ?")) return;
    const { error } = await supabase.from("deletion_requests").insert({});
    if (!error) setDeletion(true);
  }

  const isRider = me.role === "rider";

  return (
    <div className="page">
      <BackHeader />
      <div className="row" style={{ gap: 16 }}>
        <button className="btn-ghost" style={{ border: "none", background: "none", padding: 0, cursor: "pointer" }} onClick={() => fileRef.current?.click()} aria-label="Changer ma photo">
          <Avatar path={me.avatar_path} name={me.first_name} size={72} />
        </button>
        <div className="grow">
          <h1 className="h1" style={{ fontSize: 26 }}>{me.first_name} {me.last_name}</h1>
          {isRider && me.program && <div className="muted small">{PROGRAM_LABEL[me.program]}{me.program_start ? ` depuis le ${fmtDate(me.program_start, { day: "numeric", month: "long", year: "numeric" })}` : ""}</div>}
          <button className="btn btn-ghost btn-sm" style={{ padding: 0 }} onClick={() => fileRef.current?.click()}>Changer ma photo</button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) changePhoto(file); e.target.value = ""; }} />
      </div>

      <section className="stack">
        <div className="field"><label htmlFor="fn">Prénom</label>
          <input id="fn" className="input" value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} onBlur={() => f.first_name.trim() && save({ first_name: f.first_name.trim() })} /></div>
        {isRider && (
          <>
            <div className="field"><span className="label">Discipline</span>
              <div className="pills" role="group" aria-label="Discipline">
                {DISCIPLINES.map((d) => (
                  <button key={d} className="pill" aria-pressed={f.discipline === d} onClick={() => { setF({ ...f, discipline: d }); save({ discipline: d }); }}>{d}</button>
                ))}
              </div></div>
            <div className="field"><label htmlFor="lv">Niveau</label>
              <input id="lv" className="input" placeholder="Ex. : Amateur 2, Club 1…" value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })} onBlur={() => save({ level: f.level })} /></div>
            <div className="field"><label htmlFor="hn">Nom de mon cheval</label>
              <input id="hn" className="input" value={f.horse_name} onChange={(e) => setF({ ...f, horse_name: e.target.value })} onBlur={() => save({ horse_name: f.horse_name })} /></div>
            <div className="field"><label htmlFor="sg">Mon objectif de saison</label>
              <textarea id="sg" className="textarea" rows={2} placeholder="Fixé avec Christina lors du premier module" value={f.season_goal} onChange={(e) => setF({ ...f, season_goal: e.target.value })} onBlur={() => save({ season_goal: f.season_goal })} /></div>
          </>
        )}
        {saved && <div className="success">{saved}</div>}
        {err && <div className="error">{err}</div>}
      </section>

      <section className="card stack">
        <h2 className="h2">Notifications</h2>
        {push === "unsupported" ? (
          <div className="small muted">
            {isIOS() && !isStandalone()
              ? "Sur iPhone, ajoute d'abord l'appli à ton écran d'accueil (bouton Partager, puis « Sur l'écran d'accueil »), puis ouvre-la depuis l'icône."
              : "Ce navigateur ne permet pas les notifications."}
          </div>
        ) : push === "denied" ? (
          <div className="small muted">Les notifications sont bloquées. Autorise-les dans les réglages de ton téléphone, rubrique Notifications, puis Évolution.</div>
        ) : (
          <button className={`btn btn-sm ${push === "on" ? "btn-light" : ""}`} style={{ alignSelf: "flex-start" }} onClick={togglePush}>
            <Icon name="bell" size={18} />{push === "on" ? "Désactiver sur ce téléphone" : "Activer sur ce téléphone"}
          </button>
        )}
        {([
          ["messages", "Nouveaux messages"],
          ...(isRider ? [["checkin", "Rappel de check-in"], ["competition", "Veille et lendemain de concours"], ["session", "Rappel de séance"]] : []),
        ] as [keyof P["notif_prefs"], string][]).map(([k, label]) => (
          <label key={k} className="check">
            <input type="checkbox" checked={prefs[k] !== false} onChange={(e) => { const p = { ...prefs, [k]: e.target.checked }; setPrefs(p); save({ notif_prefs: p }); }} />
            <span>{label}</span>
          </label>
        ))}
      </section>

      <section className="stack">
        <Link to="/confidentialite" className="card card-link"><div className="grow">Confidentialité et données personnelles</div><Icon name="chevron" size={18} /></Link>
        <button className="btn btn-light btn-block" onClick={signOut}><Icon name="logout" size={18} />Me déconnecter</button>
        {isRider && (deletion ? (
          <div className="success">Ta demande de suppression est enregistrée. Christina s'en occupe et te prévient.</div>
        ) : (
          <button className="btn btn-ghost" style={{ color: "var(--danger)" }} onClick={requestDeletion}>Supprimer mon compte et mes données</button>
        ))}
        {isRider && me.is_junior && <div className="hint">Compte junior créé avec l'accord de {me.parent_name ?? g(me, "ton parent", "ton parent")}.</div>}
      </section>
    </div>
  );
}
