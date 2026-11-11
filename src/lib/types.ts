export type Role = "coach" | "rider";
export type Program = "starter90" | "levelup180" | "club";
export type Status = "active" | "alumni" | "archived";

export type Profile = {
  id: string;
  role: Role;
  email: string | null;
  first_name: string;
  last_name: string;
  gender: "f" | "m";
  program: Program | null;
  program_start: string | null;
  status: Status;
  is_junior: boolean;
  parent_name: string | null;
  parent_email: string | null;
  parent_consent_at: string | null;
  consent_at: string | null;
  activated_at: string | null;
  discipline: string | null;
  level: string | null;
  horse_name: string | null;
  season_goal: string | null;
  season_goal_progress: number;
  avatar_path: string | null;
  anchor_word: string | null;
  current_module: string | null;
  modules_done: number;
  notif_prefs: { messages: boolean; checkin: boolean; competition: boolean; session: boolean };
  rescue_text: string | null;
  junior_mission_index: number;
  self_signup: boolean;
  created_at: string;
};

export type Settings = {
  app_url: string;
  calendly_url: string;
  training_url: string;
  response_time_text: string;
  slots_text: string;
  thresholds: { confidence_drop: number; no_checkin_days: number; program_end_days: number; stress_high: number };
  program_weeks: { starter90: number; levelup180: number };
  rescue_text: string;
  signup_code: string;
};

export type Checkin = {
  id: string; rider_id: string; week_start: string;
  confidence: number; stress: number; focus: number; motivation: number;
  mind: string | null; created_at: string;
};

export type GoalItem = { text: string; done: boolean };
export type WeeklyGoals = {
  id: string; rider_id: string; week_start: string;
  goals: GoalItem[]; process_goals: GoalItem[]; takeaway: string | null; updated_at: string;
};

export type Competition = { id: string; rider_id: string; date: string; location: string; event: string; height: string };

export type Debrief = {
  id: string; rider_id: string; competition_id: string | null; kind: "concours" | "cours";
  date: string; title: string; result: string | null;
  mental_before: string | null; mental_during: string | null; mental_after: string | null;
  went_well: string | null; change_next: string | null; coach_read_at: string | null; created_at: string;
};

export type RoutineStep = { id: string; text: string };
export type Phase = "avant" | "pendant" | "apres";
export type Routine = { rider_id: string; steps: Record<Phase, RoutineStep[]>; checked: string[]; updated_at: string };
export type RoutineAudio = { id: string; rider_id: string; title: string; path: string };

export type Session = {
  id: string; rider_id: string; number: number | null; theme: string;
  scheduled_at: string | null; visio_url: string | null; prep: string | null; done: boolean;
  booked_at: string | null;
};

export type Message = {
  id: string; thread_rider_id: string | null; sender_id: string | null;
  kind: "text" | "victory" | "auto" | "urgent"; body: string | null;
  image_path: string | null; audio_path: string | null; audio_seconds: number | null; video_path: string | null;
  pinned: boolean; created_at: string;
};

export type Member = { id: string; first_name: string; gender: "f" | "m"; role: Role; avatar_path: string | null };

export type Alert = { rider_id: string; kind: string; ref_key: string; detail: string; created_at: string };

export type Resource = {
  id: string; rider_id: string | null; category: "audio" | "fichier" | "lien" | "feedback";
  title: string; description: string | null; path: string | null; url: string | null; created_at: string;
};

export type JuniorMission = { id: string; position: number; title: string; body: string; after_message: string; pdf_path: string | null };

export type Feedback = {
  id: string; rider_id: string; competition_id: string | null; date: string; title: string;
  answers: Record<string, string>; coach_read_at: string | null; created_at: string;
};
