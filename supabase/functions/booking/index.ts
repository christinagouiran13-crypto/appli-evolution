// Réservation faite sur Calendly depuis l'appli : on note la séance suivante
// comme réservée (date et lien visio si la clé Calendly est configurée).
import { adminClient, cors, json } from "../_shared/common.ts";

const CALENDLY = "https://api.calendly.com/scheduled_events/";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const db = adminClient();
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: u } = await db.auth.getUser(token);
  if (!u?.user) return json({ error: "Connexion requise." }, 401);
  const { data: me } = await db.from("profiles").select("id, role, status, program").eq("id", u.user.id).single();
  if (!me || me.role !== "rider" || me.status !== "active") return json({ error: "Réservé aux clientes en cours d'accompagnement." }, 403);

  const body = await req.json().catch(() => ({}));
  const eventUri = String(body.event_uri ?? "");
  if (!eventUri.startsWith(CALENDLY)) return json({ error: "Réservation inconnue." }, 400);

  // Déjà enregistrée ?
  const { data: existing } = await db.from("sessions").select("*").eq("calendly_event_uri", eventUri).maybeSingle();
  if (existing) return json({ session: existing });

  // Détails du rendez-vous (date, lien visio) si la clé Calendly est configurée
  let startTime: string | null = null;
  let visio: string | null = null;
  const calToken = Deno.env.get("CALENDLY_TOKEN");
  if (calToken) {
    const r = await fetch(eventUri, { headers: { Authorization: `Bearer ${calToken}` } });
    if (!r.ok) return json({ error: "Réservation introuvable chez Calendly." }, 400);
    const ev = (await r.json()).resource ?? {};
    startTime = ev.start_time ?? null;
    visio = ev.location?.join_url ?? null;
  }

  // Prochaine séance pas encore réservée (ou une nouvelle séance)
  const { data: next } = await db.from("sessions").select("*").eq("rider_id", me.id).eq("done", false)
    .is("booked_at", null).is("scheduled_at", null).order("number", { ascending: true }).limit(1).maybeSingle();
  const fields = { booked_at: new Date().toISOString(), scheduled_at: startTime, calendly_event_uri: eventUri, ...(visio ? { visio_url: visio } : {}) };
  let session;
  if (next) {
    ({ data: session } = await db.from("sessions").update(fields).eq("id", next.id).select().single());
  } else {
    const { data: last } = await db.from("sessions").select("number").eq("rider_id", me.id)
      .order("number", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
    ({ data: session } = await db.from("sessions").insert({
      rider_id: me.id, number: (last?.number ?? 0) + 1,
      theme: me.program === "levelup180" ? "Séance mensuelle" : "Séance", ...fields,
    }).select().single());
  }
  await db.from("appointment_requests").update({ status: "done" }).eq("rider_id", me.id).eq("status", "pending");
  return json({ session });
});
