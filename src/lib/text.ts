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
  urgent: "URGENCE",
  new_signup: "Nouvelle inscription",
  feedback_unread: "Feedback à lire",
  confidence_drop: "Confiance en baisse",
  stress_high: "Stress élevé",
  dropout: "Décrochage",
  debrief_unread: "Débrief à lire",
  message_waiting: "Message en attente",
  appointment: "Demande de rendez-vous",
  program_end: "Fin de programme",
  deletion: "Suppression demandée",
};

// Questionnaire de feedback après concours (questions de Christina)
export const FEEDBACK_QUESTIONS: { key: string; f: string; m: string }[] = [
  { key: "q1", f: "Qu'est-ce que tu as trouvé le plus difficile mentalement pendant le concours ?", m: "Qu'est-ce que tu as trouvé le plus difficile mentalement pendant le concours ?" },
  { key: "q2", f: "Est-ce qu'il y a un moment où tu t'es sentie vraiment bien dans ta tête et avec ton cheval ?", m: "Est-ce qu'il y a un moment où tu t'es senti vraiment bien dans ta tête et avec ton cheval ?" },
  { key: "q3", f: "D'un point de vue technique, qu'est-ce que tu penses devoir encore améliorer ?", m: "D'un point de vue technique, qu'est-ce que tu penses devoir encore améliorer ?" },
  { key: "q4", f: "Sur quels points tu penses avoir progressé ? Mental et technique.", m: "Sur quels points tu penses avoir progressé ? Mental et technique." },
  { key: "q5", f: "Qu'est-ce qui t'a le plus aidée pendant le concours ?", m: "Qu'est-ce qui t'a le plus aidé pendant le concours ?" },
  { key: "q6", f: "Qu'est-ce que tu aurais aimé avoir en plus (exercice, conseil, préparation…) ?", m: "Qu'est-ce que tu aurais aimé avoir en plus (exercice, conseil, préparation…) ?" },
  { key: "q7", f: "Si tu devais refaire le concours, qu'est-ce que tu changerais ?", m: "Si tu devais refaire le concours, qu'est-ce que tu changerais ?" },
];
