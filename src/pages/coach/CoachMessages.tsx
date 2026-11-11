import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { relativeDay } from "../../lib/dates";
import type { Message, Profile } from "../../lib/types";
import { Avatar } from "../../components/Avatar";
import { Chat } from "../../components/Chat";

type Thread = { rider: Profile; last: Message | null; unread: boolean };

export default function CoachMessages() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [sel, setSel] = useState<string | null>(null); // null = groupe

  const load = async () => {
    const [p, m, r] = await Promise.all([
      supabase.from("profiles").select("*").eq("role", "rider").neq("status", "archived").order("first_name"),
      supabase.from("messages").select("*").not("thread_rider_id", "is", null).order("created_at", { ascending: false }).limit(500),
      supabase.from("read_state").select("thread, last_read_at"),
    ]);
    const reads = new Map((r.data ?? []).map((x) => [x.thread, x.last_read_at as string]));
    const msgs = (m.data as Message[]) ?? [];
    const list = ((p.data as Profile[]) ?? []).map((rider) => {
      const last = msgs.find((x) => x.thread_rider_id === rider.id) ?? null;
      const unread = !!last && last.sender_id === rider.id && last.created_at > (reads.get(rider.id) ?? "");
      return { rider, last, unread };
    }).sort((a, b) => (b.last?.created_at ?? "").localeCompare(a.last?.created_at ?? ""));
    setThreads(list);
  };
  useEffect(() => {
    load();
    const ch = supabase.channel("coach-threads").on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => setTimeout(load, 300)).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 320px) minmax(0, 1fr)", gap: 16 }} className="msg-layout">
      <style>{`@media (max-width: 760px) { .msg-layout { grid-template-columns: 1fr !important; } }`}</style>
      <div className="stack-sm">
        <button className="card card-link" style={{ textAlign: "left", background: sel === null ? "var(--vert-eau)" : undefined }} onClick={() => setSel(null)}>
          <div className="icon-tile">É</div>
          <div className="grow"><div className="h3">Groupe Évolution</div><div className="small muted">Toutes les cavalières</div></div>
        </button>
        {threads.map((t) => (
          <button key={t.rider.id} className="card card-link" style={{ textAlign: "left", background: sel === t.rider.id ? "var(--vert-eau)" : undefined }} onClick={() => setSel(t.rider.id)}>
            <Avatar path={t.rider.avatar_path} name={t.rider.first_name} size={40} />
            <div className="grow">
              <div className="row-between"><span className="h3">{t.rider.first_name} {t.rider.last_name}</span>
                {t.last && <span className="tiny muted">{relativeDay(t.last.created_at)}</span>}</div>
              <div className="small muted" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: t.unread ? 700 : 400, color: t.unread ? "var(--vert-fonce)" : undefined }}>
                {t.last ? (t.last.body ?? (t.last.audio_path ? "Message vocal" : t.last.video_path ? "Vidéo" : "Photo")) : "Pas encore de message"}
              </div>
            </div>
            {t.unread && <span className="tag tag-rose">Nouveau</span>}
          </button>
        ))}
      </div>
      <div className="chat-embed">
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--bord)" }} className="h3">
          {sel === null ? "Groupe Évolution · touche un de tes messages pour l'épingler" : threads.find((t) => t.rider.id === sel)?.rider.first_name}
        </div>
        <Chat key={sel ?? "group"} thread={sel} className="chat" />
      </div>
    </div>
  );
}
