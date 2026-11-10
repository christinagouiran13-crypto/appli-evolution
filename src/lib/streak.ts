import { addDays, currentWeek } from "./dates";

// Série de check-ins : une semaine manquée met la série en pause,
// deux semaines manquées d'affilée la remettent à zéro.
export function computeStreak(weeks: string[]) {
  const set = new Set(weeks);
  const now = currentWeek();
  let count = 0;
  let missedInARow = 0;
  let paused = false;
  let w = now;
  // La semaine en cours ne compte comme manquée que si elle est finie
  if (!set.has(now)) w = addDays(now, -7);
  for (let i = 0; i < 520; i++) {
    if (set.has(w)) {
      count++;
      missedInARow = 0;
    } else {
      missedInARow++;
      if (count === 0 && i === 0) paused = true;
      if (missedInARow >= 2) break;
    }
    w = addDays(w, -7);
  }
  // En pause si la dernière semaine terminée est manquée
  paused = !set.has(now) && !set.has(addDays(now, -7)) && count > 0;
  return { count, paused, doneThisWeek: set.has(now) };
}
