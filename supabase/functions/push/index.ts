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

  // Notification de test envoyée à soi-même (bouton « Tester » dans l'appli)
  if (body.type === "test") {
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: u } = await db.auth.getUser(token);
    if (!u?.user) return json({ error: "Connexion requise." }, 401);
    const { count } = await db.from("push_subscriptions").select("endpoint", { count: "exact", head: true }).eq("user_id", u.user.id);
    const sent = await sendPush(db, [u.user.id], { title: "Évolution", body: "Test réussi : tu recevras bien les notifications sur cet appareil.", url: "/" });
    return json({ devices: count ?? 0, sent });
  }

  if (!(await checkInternal(req, db))) return json({ error: "forbidden" }, 403);

  // Notification directe (ex. : confirmation de séance d'une junior)
  if (body.type === "notify") {
    const { data: p } = await db.from("profiles").select("id, notif_prefs").eq("id", body.user_id).single();
    if (!p || (body.pref && p.notif_prefs?.[body.pref] === false)) return json({ skipped: true });
    const sent = await sendPush(db, [p.id], { title: body.title ?? "Évolution", body: body.body ?? "", url: body.url ?? "/" });
    return json({ sent });
  }

  if (body.type === "message") {
    const { data: m } = await db.from("messages").select("*").eq("id", body.message_id).single();
    if (!m || m.kind === "auto") return json({ skipped: true }); // les messages auto sont notifiés par le planificateur

    const { data: sender } = await db.from("profiles").select("id, first_name, role").eq("id", m.sender_id).single();
    const preview = m.body ? truncate(m.body) : m.image_path ? "Photo" : m.video_path ? "Vidéo" : "Message vocal";

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
      title = m.kind === "urgent"
        ? `🚨 URGENCE · ${sender?.first_name ?? "une cliente"}`
        : `Message de ${sender?.first_name ?? "une cliente"}`;
      url = `/coach/cliente/${m.thread_rider_id}?onglet=messages`;
    }

    const urgent = m.kind === "urgent";
    // Une urgence est toujours notifiée, même si les notifications de messages sont coupées
    const ids = recipients.filter((r) => urgent || r.notif_prefs?.messages !== false).map((r) => r.id);
    const sent = await sendPush(db, ids, {
      title, body: urgent && !m.body ? "A besoin de toi rapidement." : preview, url,
      tag: urgent ? `urgent-${m.id}` : `msg-${m.thread_rider_id ?? "groupe"}`, urgent,
    });
    return json({ sent });
  }

  return json({ error: "unknown type" }, 400);
});
