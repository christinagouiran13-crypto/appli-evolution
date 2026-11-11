import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { currentWeek, todayISO, weekendRange } from "../../lib/dates";
import type { Alert, Checkin, Competition, Profile } from "../../lib/types";

export type ClientRow = Profile & {
  lastCheckin: Checkin | null;
  trend: { from: number; to: number } | null;
  nextComp: Competition | null;
  alerts: Alert[];
};

// Tout ce qu'il faut pour le tableau de bord de la coach, en quelques requêtes
export function useCoachData() {
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const today = todayISO();
    const [p, c, comps, a] = await Promise.all([
      supabase.from("profiles").select("*").eq("role", "rider").order("first_name"),
      supabase.from("checkins").select("*").gte("week_start", new Date(Date.now() - 70 * 86400000).toISOString().slice(0, 10)).order("week_start"),
      supabase.from("competitions").select("*").gte("date", today).order("date"),
      supabase.rpc("coach_alerts"),
    ]);
    const [{ data: ns }, { data: fb }] = await Promise.all([supabase.rpc("coach_new_signups"), supabase.rpc("coach_feedback_alerts")]);
    const al = [...((a.data as Alert[]) ?? []), ...((fb as Alert[]) ?? []), ...((ns as Alert[]) ?? [])];
    const checkins = (c.data as Checkin[]) ?? [];
    const list = ((p.data as Profile[]) ?? []).map((r) => {
      const mine = checkins.filter((x) => x.rider_id === r.id);
      const last = mine[mine.length - 1] ?? null;
      const prev = last ? mine.filter((x) => x.week_start < last.week_start && x.week_start >= addDaysISO(last.week_start, -14))[0] : undefined;
      return {
        ...r,
        lastCheckin: last,
        trend: last && prev ? { from: prev.confidence, to: last.confidence } : null,
        nextComp: ((comps.data as Competition[]) ?? []).find((x) => x.rider_id === r.id) ?? null,
        alerts: al.filter((x) => x.rider_id === r.id),
      };
    });
    setRows(list);
    setAlerts(al);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const active = rows.filter((r) => r.status === "active");
  const wk = weekendRange();
  const kpis = {
    active: active.length,
    checkins: active.filter((r) => r.lastCheckin?.week_start === currentWeek()).length,
    weekend: active.filter((r) => r.nextComp && r.nextComp.date >= wk.from && r.nextComp.date <= wk.to).length,
    todo: new Set(alerts.map((x) => x.rider_id)).size,
  };
  return { rows, alerts, loading, reload: load, kpis, weekend: wk };
}

function addDaysISO(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
