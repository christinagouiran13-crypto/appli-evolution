// Messages automatiques — appelé toutes les 15 minutes par la base.
// Chaque message n'est envoyé qu'une fois grâce au journal auto_message_log.
import { adminClient, checkInternal, cors, json, sendPush, truncate } from "../_shared/common.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.4";

const TZ = "Europe/Paris";

// Date et heure actuelles à Paris
function parisNow(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23",
    }).formatToParts(now).map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    weekday: parts.weekday as string, // "Tue"…
  };
}

function addDays(isoDate: string, n: number) {
  const d = new Date(isoDate + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function mondayOf(isoDate: string) {
  const d = new Date(isoDate + "T12:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7;
  return addDays(isoDate, -dow);
}

function isoWeekNumber(isoDate: string) {
  const d = new Date(isoDate + "T12:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

function fill(tpl: string, rider: Rider, extra: Record<string, string> = {}) {
  let out = tpl
    .replaceAll("{prenom}", rider.first_name ?? "")
    .replaceAll("{cavaliere}", rider.gender === "m" ? "cavalier" : "cavalière");
  for (const [k, v] of Object.entries(extra)) out = out.replaceAll(`{${k}}`, v);
  return out.replace(/\{[a-z_]+\}/g, "").replace(/\s+$/g, "").trim();
}

type Rider = {
  id: string; first_name: string; gender: string; program: string | null; program_start: string | null;
  created_at: string; activated_at: string | null; notif_prefs: Record<string, boolean>;
};

type Ctx = {
  db: SupabaseClient;
  coachId: string;
  templates: Record<string, { body: string; enabled: boolean }>;
  sent: string[];
};

// Envoie un message automatique (conversation privée + notification), une seule fois.
async function deliver(
  ctx: Ctx, rider: Rider, code: string, logCode: string, refKey: string,
  pref: string, url: string, extra: Record<string, string> = {},
) {
  const tpl = ctx.templates[code];
  if (!tpl || !tpl.enabled) return;
  const { error: logErr } = await ctx.db.from("auto_message_log")
    .insert({ rider_id: rider.id, code: logCode, ref_key: refKey });
  if (logErr) return; // déjà envoyé
  const text = fill(tpl.body, rider, extra);
  await ctx.db.from("messages").insert({
    thread_rider_id: rider.id, sender_id: ctx.coachId, kind: "auto", body: text,
  });
  if (rider.notif_prefs?.[pref] !== false) {
    await sendPush(ctx.db, [rider.id], { title: "Christina", body: truncate(text), url, tag: code });
  }
  ctx.sent.push(`${code}:${rider.first_name}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const db = adminClient();
  if (!(await checkInternal(req, db))) return json({ error: "forbidden" }, 403);

  const body = await req.json().catch(() => ({}));
  const now = body.now ? new Date(body.now) : new Date(); // « now » permet de tester
  const { date: today, hour, weekday } = parisNow(now);
  const tomorrow = addDays(today, 1);
  const yesterday = addDays(today, -1);

  const { data: coach } = await db.from("profiles").select("id").eq("role", "coach").order("created_at").limit(1).single();
  if (!coach) return json({ skipped: "no coach" });

  const { data: tpls } = await db.from("auto_messages").select("code, body, enabled");
  const ctx: Ctx = {
    db, coachId: coach.id, sent: [],
    templates: Object.fromEntries((tpls ?? []).map((t) => [t.code, t])),
  };

  const { data: settings } = await db.from("app_settings").select("program_weeks").single();
  const weeks = (settings?.program_weeks ?? { starter90: 12, levelup180: 26 }) as Record<string, number>;

  const { data: riderRows } = await db.from("profiles")
    .select("id, first_name, gender, program, program_start, created_at, activated_at, notif_prefs")
    .eq("role", "rider").eq("status", "active").not("activated_at", "is", null);
  const riders = (riderRows ?? []) as Rider[];
  const byId = new Map(riders.map((r) => [r.id, r]));

  // 1. Message du mardi (à partir de 9 h), deux versions en alternance
  if (weekday === "Tue" && hour >= 9) {
    const week = mondayOf(today);
    const code = isoWeekNumber(today) % 2 === 0 ? "tuesday_a" : "tuesday_b";
    for (const r of riders) await deliver(ctx, r, code, "tuesday", week, "checkin", "/checkin");
  }

  // 2. Veille de concours (à partir de 18 h)
  if (hour >= 18) {
    const { data: comps } = await db.from("competitions").select("id, rider_id").eq("date", tomorrow);
    for (const c of comps ?? []) {
      const r = byId.get(c.rider_id);
      if (r) await deliver(ctx, r, "eve_competition", "eve_competition", c.id, "competition", "/routine");
    }
  }

  // 3. Lendemain de concours (à partir de 10 h) si le débrief n'est pas fait
  if (hour >= 10) {
    const { data: comps } = await db.from("competitions").select("id, rider_id").eq("date", yesterday);
    for (const c of comps ?? []) {
      const r = byId.get(c.rider_id);
      if (!r) continue;
      const { count } = await db.from("debriefs").select("id", { count: "exact", head: true }).eq("competition_id", c.id);
      if (!count) await deliver(ctx, r, "after_competition", "after_competition", c.id, "competition", `/concours/debrief?concours=${c.id}`);
    }
  }

  // 4. Relance douce : 7 jours sans check-in (à partir de 10 h)
  if (hour >= 10) {
    for (const r of riders) {
      const { data: last } = await db.from("checkins").select("id, created_at")
        .eq("rider_id", r.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const since = new Date(last?.created_at ?? r.activated_at!);
      if (now.getTime() - since.getTime() >= 7 * 86400000) {
        await deliver(ctx, r, "no_checkin_7d", "no_checkin_7d", last?.id ?? "none", "checkin", "/checkin");
      }
    }
  }

  // 5. Veille de séance (à partir de 18 h)
  if (hour >= 18) {
    const start = new Date(`${tomorrow}T00:00:00Z`);
    const { data: sessions } = await db.from("sessions").select("id, rider_id, scheduled_at, visio_url")
      .eq("done", false)
      .gte("scheduled_at", new Date(start.getTime() - 3 * 3600000).toISOString())
      .lt("scheduled_at", new Date(start.getTime() + 27 * 3600000).toISOString());
    for (const s of sessions ?? []) {
      if (parisNow(new Date(s.scheduled_at)).date !== tomorrow) continue;
      const r = byId.get(s.rider_id);
      if (!r) continue;
      const heure = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })
        .format(new Date(s.scheduled_at)).replace(":", " h ");
      await deliver(ctx, r, "eve_session", "eve_session", s.id, "session", "/", {
        heure, lien: s.visio_url ? `Lien de la visio : ${s.visio_url}` : "",
      });
    }
  }

  // 6. Fin de Starter 90 (à partir de 10 h, le jour de la fin et la semaine suivante)
  if (hour >= 10) {
    for (const r of riders) {
      if (r.program !== "starter90" || !r.program_start) continue;
      const end = addDays(r.program_start, (weeks.starter90 ?? 12) * 7);
      if (today >= end && today <= addDays(end, 7)) {
        await deliver(ctx, r, "end_starter", "end_starter", r.program_start, "session", "/");
      }
    }
  }

  // 7. Badge « 3 mois d'Évolution »
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  for (const r of riders) {
    const start = r.program_start ? new Date(r.program_start + "T00:00:00Z") : new Date(r.created_at);
    if (start <= threeMonthsAgo) {
      await db.from("badges").upsert({ rider_id: r.id, code: "trois_mois" }, { onConflict: "rider_id,code", ignoreDuplicates: true });
    }
  }

  return json({ today, hour, weekday, sent: ctx.sent });
});
