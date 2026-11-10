// Notifications push.
// - { type: "vapid" } : renvoie la clé publique (utilisée par l'appli pour s'abonner)
// - { type: "message", message_id } : appelé par la base à chaque nouveau message
import { adminClient, checkInternal, cors, getConfig, json, sendPush, truncate } from "../_shared/common.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const db = adminClient();
  const body = await req.json().catch(() => ({}));

  if (body.type === "vapid") {
    const cfg = await getConfig(db);
    return json({ publicKey: cfg.vapid_public });
  }

  if (!(await checkInternal(req, db))) return json({ error: "forbidden" }, 403);

  if (body.type === "message") {
    const { data: m } = await db.from("messages").select("*").eq("id", body.message_id).single();
    if (!m || m.kind === "auto") return json({ skipped: true }); // les messages auto sont notifiés par le planificateur

    const { data: sender } = await db.from("profiles").select("id, first_name, role").eq("id", m.sender_id).single();
    const preview = m.body ? truncate(m.body) : m.image_path ? "Photo" : "Message vocal";

    let recipients: { id: string; notif_prefs: Record<string, boolean> }[] = [];
    let title = "";
    let url = "/messages";

    if (m.thread_rider_id === null) {
      const { data } = await db.from("profiles").select("id, notif_prefs")
        .in("status", ["active", "alumni"]).neq("id", m.sender_id ?? "");
      recipients = data ?? [];
      title = m.kind === "victory"
        ? `Victoire de ${sender?.first_name ?? ""} 🎉`
        : `Groupe Évolution · ${sender?.first_name ?? ""}`;
      url = "/messages?fil=groupe";
    } else if (sender?.role === "coach") {
      const { data } = await db.from("profiles").select("id, notif_prefs").eq("id", m.thread_rider_id);
      recipients = data ?? [];
      title = "Christina";
      url = "/messages?fil=coach";
    } else {
      const { data } = await db.from("profiles").select("id, notif_prefs").eq("role", "coach");
      recipients = data ?? [];
      title = `Message de ${sender?.first_name ?? "une cliente"}`;
      url = `/coach/cliente/${m.thread_rider_id}?onglet=messages`;
    }

    const ids = recipients.filter((r) => r.notif_prefs?.messages !== false).map((r) => r.id);
    const sent = await sendPush(db, ids, { title, body: preview, url, tag: `msg-${m.thread_rider_id ?? "groupe"}` });
    return json({ sent });
  }

  return json({ error: "unknown type" }, 400);
});
