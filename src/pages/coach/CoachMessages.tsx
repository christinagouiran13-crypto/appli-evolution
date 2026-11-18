import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ensureRealtimeAuth, supabase } from "../../lib/supabase";
import { relativeDay } from "../../lib/dates";
import type { Message, Profile } from "../../lib/types";
import { Avatar } from "../../components/Avatar";
import { Chat, markRead } from "../../components/Chat";
import { Icon } from "../../components/Icon";

type Thread = { rider: Profile; last: Message | null; unread: boolean };

function preview(m: Message | null) {
  if (!m) return "Pas encore de message";
  if (m.kind === "urgent") return "🚨 URGENCE" + (m.body ? ` · ${m.body}` : "");
  return m.body ?? (m.audio_path ? "Vocal" : m.video_path ? "Vidéo" : "Photo");
}

// Messagerie de la coach : « Équipe Évolution » (groupe) et « One-to-one » (privés)
export default function CoachMessages() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("onglet") === "prive" ? "prive" : "equipe";
  const sel = params.get("cliente");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [groupUnread, setGroupUnread] = useState(0);
  const [q, setQ] = useState("");
  const [wide, setWide] = useState(() => window.matchMedia("(min-width: 900px)").matches);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const on = () => setWide(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const load = useCallback(async () => {
    const { data: s } = await supabase.auth.getSession();
    const me = s.session?.user.id;
    const [p, m, r] = await Promise.all([
      supabase.from("profiles").select("*").eq("role", "rider").neq("status", "archived").order("first_name"),
      supabase.from("messages").select("*").not("thread_rider_id", "is", null).order("created_at", { ascending: false }).limit(1000),
      supabase.from("read_state").select("thread, last_read_at"),
    ]);
    const reads = new Map((r.data ?? []).map((x) => [x.thread, x.last_read_at as string]));
    const msgs = (m.data as Message[]) ?? [];
    const list = ((p.data as Profile[]) ?? []).map((rider) => {
      const last = msgs.find((x) => x.thread_rider_id === rider.id) ?? null;
      const unread = !!last && last.sender_id === rider.id && last.created_at > (reads.get(rider.id) ?? "");
      return { rider, last, unread };
    }).sort((a, b) => Number(b.unread) - Number(a.unread) || (b.last?.created_at ?? "").localeCompare(a.last?.created_at ?? ""));
    setThreads(list);
    if (me) {
      const { count } = await supabase.from("messages").select("id", { count: "exact", head: true })
        .is("thread_rider_id", null).neq("sender_id", me).gt("created_at", reads.get("group") ?? "1970-01-01");
      setGroupUnread(count ?? 0);
    }
  }, []);

  useEffect(() => {
    load();
    let ch: ReturnType<typeof supabase.channel> | null = null;
    let alive = true;
    ensureRealtimeAuth().then(() => {
      if (!alive) return;
      ch = supabase.channel(`coach-threads-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => setTimeout(load, 300))
        .subscribe();
    });
    const t = window.setInterval(load, 30000);
    return () => { alive = false; if (ch) supabase.removeChannel(ch); clearInterval(t); };
  }, [load]);

  const go = (onglet: "equipe" | "prive", cliente?: string | null) => {
    const next: Record<string, string> = { onglet };
    if (cliente) next.cliente = cliente;
    setParams(next);
    if (onglet === "equipe") { markRead(null).then(load); }
    if (cliente) markRead(cliente).then(load);
  };

  const privateUnread = threads.filter((t) => t.unread).length;
  const shown = threads.filter((t) => `${t.rider.first_name} ${t.rider.last_name}`.toLowerCase().includes(q.trim().toLowerCase()));
  const current = threads.find((t) => t.rider.id === sel)?.rider;

  const tabs = (
    <div className="segmented" role="group" aria-label="Type de conversation">
      <button aria-pressed={tab === "equipe"} onClick={() => go("equipe")}>
        Équipe Évolution{groupUnread > 0 && tab !== "equipe" ? <span className="count-pill">{groupUnread}</span> : null}
      </button>
      <button aria-pressed={tab === "prive"} onClick={() => go("prive", wide ? sel : null)}>
        One-to-one{privateUnread > 0 ? <span className="count-pill">{privateUnread}</span> : null}
      </button>
    </div>
  );

  const list = (
    <div className="stack-sm">
      <label htmlFor="search-rider" className="sr-only">Rechercher une cavalière</label>
      <input id="search-rider" className="input" type="search" placeholder="🔍 Rechercher une cavalière" value={q} onChange={(e) => setQ(e.target.value)} />
      {shown.length === 0 && <div className="empty">Aucune cavalière trouvée.</div>}
      <div className="thread-list">
        {shown.map((t) => (
          <button key={t.rider.id} className={`thread ${sel === t.rider.id ? "active" : ""} ${t.unread ? "unread" : ""}`} onClick={() => go("prive", t.rider.id)}>
            <Avatar path={t.rider.avatar_path} name={t.rider.first_name} size={44} />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="row-between">
                <span className="thread-name">{t.unread && <span className="dot-green" aria-label="non lu" />}{t.rider.first_name} {t.rider.last_name}</span>
                {t.last && <span className="tiny muted">{relativeDay(t.last.created_at)}</span>}
              </div>
              <div className="thread-preview">{preview(t.last)}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  const groupChat = (
    <div className="chat-embed coach-chat">
      <div className="chat-title row-between wrap"><span>Équipe Évolution · touche un message pour réagir ou l'épingler</span><a className="btn btn-sm btn-light" href="/coach/victoires">🏆 Mur des victoires</a></div>
      <Chat key="group" thread={null} className="chat" />
    </div>
  );

  const privateChat = sel && (
    <div className="chat-embed coach-chat">
      <div className="chat-title row" style={{ gap: 10 }}>
        {!wide && (
          <button className="icon-btn" style={{ width: 38, height: 38 }} aria-label="Retour à One-to-one" onClick={() => go("prive")}>
            <Icon name="back" size={18} />
          </button>
        )}
        {current && <Avatar path={current.avatar_path} name={current.first_name} size={30} />}
        <span className="grow">{current ? `${current.first_name} ${current.last_name}` : "Conversation"}</span>
        <a className="btn btn-sm btn-light" href={`/coach/cliente/${sel}`}>Fiche</a>
      </div>
      <Chat key={sel} thread={sel} className="chat" />
    </div>
  );

  // Téléphone : un écran à la fois
  if (!wide) {
    if (tab === "prive" && sel) return privateChat;
    return (
      <div className="stack">
        <h1 className="h1">Messages</h1>
        {tabs}
        {tab === "equipe" ? groupChat : list}
      </div>
    );
  }

  // Ordinateur : liste à gauche, conversation à droite
  return (
    <div className="stack">
      <h1 className="h1">Messages</h1>
      <div className="msg-wide">
        <div className="stack">
          {tabs}
          {tab === "prive"
            ? list
            : <div className="hint">La conversation de groupe s'affiche à droite. Passe sur « One-to-one » pour tes conversations privées.</div>}
        </div>
        {tab === "equipe" ? groupChat : privateChat || <div className="empty">Choisis une cavalière dans la liste pour ouvrir votre conversation.</div>}
      </div>
    </div>
  );
}
