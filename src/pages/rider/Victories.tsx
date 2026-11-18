import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { fmtDate } from "../../lib/dates";
import type { Member, Message } from "../../lib/types";
import { BackHeader } from "../../components/BackHeader";
import { Avatar } from "../../components/Avatar";
import { SignedImage } from "../../components/Media";
import { ShareVictory } from "../../components/ShareVictory";
import { Icon } from "../../components/Icon";

type Reaction = { message_id: string; user_id: string; emoji: string };

// Mur des victoires : toutes les victoires partagées dans l'Équipe Évolution
export default function Victories() {
  const { profile } = useAuth();
  const [list, setList] = useState<Message[]>([]);
  const [dir, setDir] = useState<Map<string, Member>>(new Map());
  const [reacts, setReacts] = useState<Reaction[]>([]);
  const [share, setShare] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: m }, { data: d }] = await Promise.all([
      supabase.from("messages").select("*").is("thread_rider_id", null).eq("kind", "victory").order("created_at", { ascending: false }).limit(200),
      supabase.from("member_directory").select("*"),
    ]);
    const msgs = (m as Message[]) ?? [];
    setList(msgs);
    setDir(new Map(((d as Member[]) ?? []).map((x) => [x.id, x])));
    if (msgs.length) {
      const { data: r } = await supabase.from("message_reactions").select("message_id, user_id, emoji").in("message_id", msgs.map((x) => x.id));
      setReacts((r as Reaction[]) ?? []);
    }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function heart(m: Message) {
    if (!profile) return;
    const mine = reacts.find((r) => r.message_id === m.id && r.user_id === profile.id);
    if (mine?.emoji === "❤️") await supabase.from("message_reactions").delete().eq("message_id", m.id).eq("user_id", profile.id);
    else await supabase.from("message_reactions").upsert({ message_id: m.id, user_id: profile.id, emoji: "❤️" }, { onConflict: "message_id,user_id" });
    load();
  }

  const canShare = profile?.role === "rider" && profile.status !== "archived";
  const isCoach = profile?.role === "coach";

  return (
    <div className={isCoach ? "stack-lg" : "page"} style={isCoach ? { maxWidth: 720 } : undefined}>
      {!isCoach && <BackHeader />}
      <div className="stack-sm">
        <h1 className="h1">🏆 Mur des victoires</h1>
        <p className="muted" style={{ margin: 0 }}>Toutes les victoires de l'Équipe Évolution. Une victoire mentale compte autant qu'un classement !</p>
      </div>
      {canShare && (
        <button className="btn btn-block" onClick={() => setShare(true)}><Icon name="trophy" size={20} />Partager ma victoire</button>
      )}
      {loading && <div className="loading">Chargement…</div>}
      {!loading && list.length === 0 && <div className="empty">Le mur attend sa première victoire. Et si c'était la tienne ?</div>}
      <div className="stack">
        {list.map((m) => {
          const who = m.sender_id ? dir.get(m.sender_id) : undefined;
          const rs = reacts.filter((r) => r.message_id === m.id);
          const hearts = rs.length;
          const mine = rs.some((r) => r.user_id === profile?.id);
          return (
            <article key={m.id} className="victory-card stack-sm">
              <div className="row" style={{ gap: 10 }}>
                <Avatar path={who?.avatar_path} name={who?.first_name ?? "?"} size={40} />
                <div className="grow">
                  <div className="h3">{who?.first_name ?? "Une cavalière"}</div>
                  <div className="tiny muted">{fmtDate(m.created_at, { day: "numeric", month: "long", year: "numeric" })}</div>
                </div>
                <span style={{ fontSize: 26 }} aria-hidden="true">🏆</span>
              </div>
              {m.image_path && <div className="victory-photo"><SignedImage path={m.image_path} alt="Photo de la victoire" /></div>}
              {m.body && <div className="victory-text">{m.body}</div>}
              <button className={`reaction ${mine ? "mine" : ""}`} style={{ alignSelf: "flex-start", marginTop: 0 }} onClick={() => heart(m)}
                aria-label={mine ? "Retirer mon cœur" : "Envoyer un cœur"}>
                ❤️{hearts > 0 && <span>{hearts}</span>}
              </button>
            </article>
          );
        })}
      </div>
      {share && <ShareVictory onClose={() => { setShare(false); load(); }} />}
    </div>
  );
}
