import { useSearchParams } from "react-router-dom";
import { useMe } from "../../lib/auth";
import { useUnread } from "../../lib/unread";
import { Chat } from "../../components/Chat";

export default function Messages() {
  const { me, settings } = useMe();
  const [params, setParams] = useSearchParams();
  const tab = params.get("fil") === "coach" ? "coach" : "groupe";
  const unread = useUnread();

  const header = (
    <div className="chat-head">
      <h1 className="h1">Messages</h1>
      <div className="segmented" role="group" aria-label="Conversation">
        <button aria-pressed={tab === "groupe"} onClick={() => setParams({ fil: "groupe" })}>
          Groupe{unread.group > 0 && tab !== "groupe" ? ` (${unread.group})` : ""}
        </button>
        <button aria-pressed={tab === "coach"} onClick={() => setParams({ fil: "coach" })}>
          Christina{unread.coach > 0 && tab !== "coach" ? ` (${unread.coach})` : ""}
        </button>
      </div>
      <div className="small muted">
        {tab === "groupe"
          ? "Groupe Évolution · toutes les cavalières et cavaliers accompagnés"
          : `Conversation privée avec Christina · ${settings?.response_time_text ?? ""}`}
      </div>
    </div>
  );

  return (
    <Chat
      key={tab}
      className="chat with-tabs"
      thread={tab === "groupe" ? null : me.id}
      header={header}
      readOnly={tab === "coach" && me.status !== "active"}
      readOnlyText="Ton programme est terminé : tu retrouves ici votre historique. Pour reprendre un accompagnement, écris à Christina dans le groupe."
    />
  );
}
