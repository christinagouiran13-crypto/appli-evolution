import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useAuth } from "./auth";
import { refreshAppBadge } from "./badge";

// Nombre de messages non lus (groupe + conversation privée) pour la cavalière
export async function countUnread(userId: string) {
  const { data: reads } = await supabase.from("read_state").select("thread, last_read_at");
  const map = new Map((reads ?? []).map((r) => [r.thread, r.last_read_at as string]));
  const since = (k: string) => map.get(k) ?? "1970-01-01";
  const [g, p] = await Promise.all([
    supabase.from("messages").select("id", { count: "exact", head: true })
      .is("thread_rider_id", null).neq("sender_id", userId).gt("created_at", since("group")),
    supabase.from("messages").select("id", { count: "exact", head: true })
      .eq("thread_rider_id", userId).neq("sender_id", userId).gt("created_at", since(userId)),
  ]);
  return { group: g.count ?? 0, coach: p.count ?? 0 };
}

export function useUnread(active = true) {
  const { profile } = useAuth();
  const userId = profile?.id;
  const [n, setN] = useState({ group: 0, coach: 0 });
  useEffect(() => {
    if (!userId || !active) return;
    let alive = true;
    const refresh = () => { refreshAppBadge(); return countUnread(userId).then((v) => alive && setN(v)); };
    refresh();
    const ch = supabase.channel(`unread-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => setTimeout(refresh, 400))
      .subscribe();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    const t = window.setInterval(refresh, 60000);
    return () => { alive = false; supabase.removeChannel(ch); window.removeEventListener("focus", onFocus); clearInterval(t); };
  }, [userId, active]);
  return n;
}
