// Outils partagés par les fonctions serveur de l'appli Évolution.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.49.4";
import webpush from "npm:web-push@3.6.7";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function serviceKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  // Nouveau format de clés Supabase
  const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
  return keys.default ?? Object.values(keys)[0];
}

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceKey() as string,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export type InternalConfig = {
  functions_url: string;
  internal_secret: string;
  vapid_public: string | null;
  vapid_private: string | null;
  vapid_subject: string;
};

export async function getConfig(db: SupabaseClient): Promise<InternalConfig> {
  const { data, error } = await db.rpc("internal_config");
  if (error) throw error;
  let cfg = (data as InternalConfig[])[0];
  if (!cfg.vapid_public || !cfg.vapid_private) {
    // Première utilisation : on crée les clés des notifications push.
    const keys = webpush.generateVAPIDKeys();
    await db.rpc("internal_set_vapid", { pub: keys.publicKey, priv: keys.privateKey });
    const again = await db.rpc("internal_config");
    cfg = (again.data as InternalConfig[])[0];
  }
  return cfg;
}

export async function checkInternal(req: Request, db: SupabaseClient) {
  const cfg = await getConfig(db);
  return req.headers.get("x-internal-secret") === cfg.internal_secret;
}

export type PushPayload = { title: string; body: string; url?: string; tag?: string; urgent?: boolean };

// Envoie une notification à un ou plusieurs comptes. Les abonnements
// expirés sont supprimés.
export async function sendPush(db: SupabaseClient, userIds: string[], payload: PushPayload) {
  if (userIds.length === 0) return 0;
  const cfg = await getConfig(db);
  webpush.setVapidDetails(cfg.vapid_subject, cfg.vapid_public!, cfg.vapid_private!);
  const { data: subs } = await db.from("push_subscriptions").select("*").in("user_id", userIds);
  let sent = 0;
  await Promise.all((subs ?? []).map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60 * 24 },
      );
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      } else {
        console.error("push error", code, (e as Error).message);
      }
    }
  }));
  return sent;
}

export function truncate(s: string, n = 120) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
