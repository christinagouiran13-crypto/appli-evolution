import { useEffect, useState } from "react";
import { currentPushState, enablePush, isIOS, isStandalone } from "../lib/push";
import { Icon } from "./Icon";
import { useAuth } from "../lib/auth";
import { g } from "../lib/text";

type BIPEvent = Event & { prompt: () => Promise<void> };
let deferred: BIPEvent | null = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferred = e as BIPEvent;
});

function hidden(key: string) {
  try { return localStorage.getItem(key) === "1"; } catch { return false; }
}
function hide(key: string) {
  try { localStorage.setItem(key, "1"); } catch { /* rien */ }
}

// Aide à l'installation sur l'écran d'accueil, puis à l'activation des notifications
export function InstallHint() {
  const { profile } = useAuth();
  const [standalone] = useState(isStandalone());
  const [push, setPush] = useState<string>("unknown");
  const [closed, setClosed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { currentPushState().then(setPush); }, []);

  if (closed) return null;

  if (!standalone && !hidden("hint-install")) {
    return (
      <div className="card stack">
        <div className="row-between">
          <div className="h3">Installe l'appli sur ton téléphone</div>
          <button className="btn btn-ghost btn-sm" onClick={() => { hide("hint-install"); setClosed(true); }}>Plus tard</button>
        </div>
        {isIOS() ? (
          <ol className="small" style={{ margin: 0, paddingLeft: 18 }}>
            <li>Ouvre cette page dans <b>Safari</b>.</li>
            <li>Touche le bouton <b>Partager</b> <Icon name="share" size={14} /> (le carré avec une flèche).</li>
            <li>Choisis <b>« Sur l'écran d'accueil »</b>, puis <b>Ajouter</b>.</li>
            <li>Ouvre ensuite Évolution depuis l'icône verte sur ton écran.</li>
          </ol>
        ) : deferred ? (
          <button className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={async () => { await deferred?.prompt(); setClosed(true); }}>
            Installer Évolution
          </button>
        ) : (
          <ol className="small" style={{ margin: 0, paddingLeft: 18 }}>
            <li>Touche le menu <b>⋮</b> en haut à droite de Chrome.</li>
            <li>Choisis <b>« Installer l'application »</b> ou <b>« Ajouter à l'écran d'accueil »</b>.</li>
          </ol>
        )}
      </div>
    );
  }

  if ((standalone || !isIOS()) && push === "off" && !hidden("hint-push")) {
    return (
      <div className="card stack">
        <div className="h3">Active les notifications</div>
        <div className="small muted">Pour être {g(profile, "prévenue", "prévenu")} des messages de Christina, de ton check-in et de tes concours.</div>
        {error && <div className="error">{error}</div>}
        <div className="row">
          <button className="btn btn-sm" onClick={async () => {
            try { await enablePush(); setPush("on"); setClosed(true); } catch (e) { setError((e as Error).message); }
          }}>Activer</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { hide("hint-push"); setClosed(true); }}>Plus tard</button>
        </div>
      </div>
    );
  }
  return null;
}
