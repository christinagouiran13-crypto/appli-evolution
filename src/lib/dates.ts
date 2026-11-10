import type { Profile, Settings } from "./types";

const TZ = "Europe/Paris";

export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export function addDays(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function mondayOf(iso: string) {
  const d = new Date(iso + "T12:00:00Z");
  return addDays(iso, -((d.getUTCDay() + 6) % 7));
}

export function currentWeek() {
  return mondayOf(todayISO());
}

export function daysBetween(a: string, b: string) {
  return Math.round((new Date(b + "T12:00:00Z").getTime() - new Date(a + "T12:00:00Z").getTime()) / 86400000);
}

export function fmtDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }) {
  if (!iso) return "—";
  const d = iso.length === 10 ? new Date(iso + "T12:00:00Z") : new Date(iso);
  return new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, ...opts }).format(d);
}

export function fmtShort(iso: string | null | undefined) {
  return fmtDate(iso, { day: "numeric", month: "short" });
}

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: TZ, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso)).replace(":", " h ");
}

export function fmtTime(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function relativeDay(iso: string) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));
  const diff = daysBetween(day, todayISO());
  if (diff === 0) return "aujourd'hui";
  if (diff === 1) return "hier";
  if (diff < 7) return fmtDate(iso, { weekday: "long" });
  return fmtShort(iso);
}

// « Semaine 5 sur 12 » / « Mois 2 sur 6 »
export function programProgress(p: Profile, s: Settings | null) {
  if (!p.program || !p.program_start || p.program === "club") return null;
  const totalWeeks = s?.program_weeks?.[p.program] ?? (p.program === "starter90" ? 12 : 26);
  const elapsed = Math.max(0, daysBetween(p.program_start, todayISO()));
  const week = Math.min(totalWeeks, Math.floor(elapsed / 7) + 1);
  const pct = Math.min(100, Math.round((elapsed / (totalWeeks * 7)) * 100));
  const end = addDays(p.program_start, totalWeeks * 7);
  if (p.program === "levelup180") {
    const months = Math.round(totalWeeks / 4.33);
    const month = Math.min(months, Math.floor(elapsed / 30.4) + 1);
    return { label: `Mois ${month} sur ${months}`, pct, end, week, totalWeeks };
  }
  return { label: `Semaine ${week} sur ${totalWeeks}`, pct, end, week, totalWeeks };
}

// Prochain week-end (vendredi → dimanche) ; le week-end en cours s'il a commencé
export function weekendRange() {
  const t = todayISO();
  const dow = (new Date(t + "T12:00:00Z").getUTCDay() + 6) % 7; // 0 = lundi
  const friday = dow <= 4 ? addDays(t, 4 - dow) : addDays(t, -(dow - 4));
  return { from: friday, to: addDays(friday, 2) };
}
