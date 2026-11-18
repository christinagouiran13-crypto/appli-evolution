import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Profile, Settings } from "./types";
import { programProgress } from "./dates";

export type TrainingModule = {
  id: string; program: string; position: number; title: string; weeks_label: string;
  week_from: number | null; week_to: number | null; description: string | null; lessons: string[]; url: string | null;
};

// Modules de formation du programme + modules terminés par la cavalière
export function useTraining(p: Profile | null, settings: Settings | null) {
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!p?.program) { setLoaded(true); return; }
    const [m, d] = await Promise.all([
      supabase.from("training_modules").select("*").eq("program", p.program).order("position"),
      supabase.from("training_progress").select("module_id").eq("rider_id", p.id),
    ]);
    setModules((m.data as TrainingModule[]) ?? []);
    setDone(new Set((d.data ?? []).map((x) => x.module_id as string)));
    setLoaded(true);
  }, [p?.id, p?.program]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // Module du moment : le premier non terminé dont la semaine est arrivée
  const week = p ? programProgress(p, settings)?.week ?? 1 : 1;
  const pending = modules.filter((m) => !done.has(m.id));
  const current = pending.filter((m) => (m.week_from ?? 0) <= week).slice(-1)[0] ?? pending[0] ?? null;
  const firstPending = pending[0] ?? null;
  return { modules, done, loaded, reload: load, current: current && firstPending && firstPending.position < current.position ? firstPending : current, week };
}
