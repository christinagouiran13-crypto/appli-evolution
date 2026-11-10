import type { Profile, Program } from "./types";

// Accord au féminin ou au masculin selon le profil
export function g(p: Pick<Profile, "gender"> | null | undefined, fem: string, masc: string) {
  return p?.gender === "m" ? masc : fem;
}

export const PROGRAM_LABEL: Record<Program, string> = {
  starter90: "Starter 90",
  levelup180: "Level Up 180",
  club: "Évolution Club",
};

export const RESULTS = [
  { code: "sans_faute", label: "Sans faute" },
  { code: "4_points", label: "4 points" },
  { code: "8_points_plus", label: "8 points et +" },
  { code: "elimination", label: "Élimination" },
  { code: "abandon", label: "Abandon" },
] as const;

export function resultLabel(code: string | null) {
  return RESULTS.find((r) => r.code === code)?.label ?? "—";
}

export const STARTER_SESSIONS = ["Objectifs", "Concentration", "Confiance en soi", "Gestion des émotions", "Plan d'action"];

export const CHECKIN_METRICS = [
  { key: "confidence", label: "Confiance en moi", low: "Fragile", high: "Solide" },
  { key: "stress", label: "Niveau de stress", low: "Calme", high: "Très stressée", highM: "Très stressé" },
  { key: "focus", label: "Concentration à cheval", low: "Dispersée", lowM: "Dispersé", high: "Focus" },
  { key: "motivation", label: "Motivation", low: "En baisse", high: "À fond" },
] as const;

export type BadgeDef = { code: string; name: [string, string]; how: string; icon: string };
export const BADGES: BadgeDef[] = [
  { code: "premier_pas", name: ["Premier pas", "Premier pas"], how: "Ton premier débrief", icon: "flag" },
  { code: "reflexive", name: ["Cavalière réflexive", "Cavalier réflexif"], how: "5 débriefs envoyés", icon: "book" },
  { code: "routine", name: ["Routine au paddock", "Routine au paddock"], how: "Ta routine suivie en entier", icon: "check" },
  { code: "module", name: ["Module validé", "Module validé"], how: "Un module de formation terminé", icon: "play" },
  { code: "sans_faute", name: ["Sans-faute", "Sans-faute"], how: "Ton premier sans-faute", icon: "star" },
  { code: "trois_mois", name: ["3 mois d'Évolution", "3 mois d'Évolution"], how: "3 mois avec Évolution", icon: "heart" },
];

export function badgeName(b: BadgeDef, p: Pick<Profile, "gender"> | null) {
  return p?.gender === "m" ? b.name[1] : b.name[0];
}

export const ALERT_LABEL: Record<string, string> = {
  confidence_drop: "Confiance en baisse",
  stress_high: "Stress élevé",
  dropout: "Décrochage",
  debrief_unread: "Débrief à lire",
  message_waiting: "Message en attente",
  appointment: "Demande de rendez-vous",
  program_end: "Fin de programme",
  deletion: "Suppression demandée",
};
