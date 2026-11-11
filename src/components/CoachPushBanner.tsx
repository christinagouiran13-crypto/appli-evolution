import { useEffect, useState } from "react";
import { currentPushState, enablePush, isIOS, isStandalone } from "../lib/push";
import { Icon } from "./Icon";

// Bandeau rouge tant que la coach n'a pas activé les notifications sur cet appareil
export function CoachPushBanner() {
  const [state, setState] = useState<string>("unknown");
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { currentPushState().then(setState); }, []);
  if (state === "on" || state === "unknown") return null;

  const iosBrowser = isIOS() && !isStandalone();
  return (
    <div style={{ background: "#B3261E", color: "#fff", padding: "12px 16px" }} role="alert">
      <div style={{ maxWidth: 1200, margin: "0 auto" }} className="stack-sm">
        <div className="row" style={{ gap: 8 }}><Icon name="bell" size={18} stroke={2.2} />
          <b>Notifications désactivées sur cet appareil : tu ne seras pas prévenue des urgences ni des messages.</b></div>
        {iosBrowser ? (
          <div className="small">Sur iPhone : ajoute l'appli à ton écran d'accueil (Partager, puis « Sur l'écran d'accueil »), ouvre-la depuis l'icône, puis active les notifications ici.</div>
        ) : state === "denied" ? (
          <div className="small">Les notifications sont bloquées : ouvre les réglages du téléphone, puis Notifications, puis Évolution, et autorise-les.</div>
        ) : state === "unsupported" ? (
          <div className="small">Ce navigateur ne permet pas les notifications. Utilise l'appli installée sur ton téléphone.</div>
        ) : (
          <button className="btn btn-sm btn-light" style={{ alignSelf: "flex-start" }} onClick={async () => {
            try { await enablePush(); setState("on"); } catch (e) { setErr((e as Error).message); }
          }}>Activer les notifications</button>
        )}
        {err && <div className="small">{err}</div>}
      </div>
    </div>
  );
}
