-- =====================================================================
-- Appli Évolution — schéma de la version 1
-- Toutes les données vivent dans Supabase (région UE).
-- Chaque table est protégée par des règles (RLS) : une cavalière ne voit
-- que ses propres données ; la coach voit tout.
-- =====================================================================

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Configuration interne (jamais visible depuis l'appli)
-- ---------------------------------------------------------------------
create table private.config (
  id boolean primary key default true check (id),
  functions_url text not null default 'http://kong:8000/functions/v1',
  internal_secret text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  vapid_public text,
  vapid_private text,
  vapid_subject text not null default 'mailto:contact@evolutioncoaching.fr'
);
insert into private.config default values;

-- ---------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------
create type public.user_role as enum ('coach', 'rider');
create type public.program_kind as enum ('starter90', 'levelup180', 'club');
create type public.member_status as enum ('active', 'alumni', 'archived');

-- ---------------------------------------------------------------------
-- Réglages de l'appli (modifiables par la coach)
-- ---------------------------------------------------------------------
create table public.app_settings (
  id boolean primary key default true check (id),
  app_url text not null default 'http://localhost:5173',
  calendly_url text not null default 'https://calendly.com/christina-battung/coaching-individuel',
  training_url text not null default 'https://www.systeme.io',
  response_time_text text not null default 'Christina répond sous 24 h, 7 jours sur 7.',
  slots_text text not null default 'Les séances ont lieu du mercredi au vendredi, le matin.',
  thresholds jsonb not null default '{"confidence_drop": 2, "no_checkin_days": 10, "program_end_days": 7, "stress_high": 8}',
  program_weeks jsonb not null default '{"starter90": 12, "levelup180": 26}',
  updated_at timestamptz not null default now()
);
insert into public.app_settings default values;

-- ---------------------------------------------------------------------
-- Profils (un par compte)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'rider',
  email text,
  first_name text not null default '',
  last_name text not null default '',
  gender text not null default 'f' check (gender in ('f', 'm')),
  program public.program_kind,
  program_start date,
  status public.member_status not null default 'active',
  is_junior boolean not null default false,
  parent_name text,
  parent_email text,
  parent_consent_at timestamptz,
  consent_at timestamptz,
  activated_at timestamptz,
  discipline text,
  level text,
  horse_name text,
  season_goal text,
  season_goal_progress int not null default 0 check (season_goal_progress between 0 and 100),
  avatar_path text,
  anchor_word text,
  current_module text,
  modules_done int not null default 0,
  notif_prefs jsonb not null default '{"messages": true, "checkin": true, "competition": true, "session": true}',
  created_at timestamptz not null default now()
);

-- Fonctions d'aide pour les règles de sécurité
create or replace function public.is_coach() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'coach');
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and status in ('active', 'alumni'));
$$;

create or replace function public.is_active_rider() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'rider' and status = 'active');
$$;

create or replace function public.coach_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from profiles where role = 'coach' order by created_at limit 1;
$$;

-- Semaine (lundi) en heure de Paris
create or replace function public.week_start(ts timestamptz default now()) returns date
language sql stable as $$
  select date_trunc('week', (ts at time zone 'Europe/Paris'))::date;
$$;

alter table public.profiles enable row level security;
create policy "profil: soi-même ou coach" on public.profiles for select
  using (id = auth.uid() or public.is_coach());
create policy "profil: modifier soi-même ou coach" on public.profiles for update
  using (id = auth.uid() or public.is_coach());

-- Une cavalière ne peut pas modifier son programme, son rôle, son statut…
create or replace function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_coach() then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.program is distinct from old.program
     or new.program_start is distinct from old.program_start
     or new.status is distinct from old.status
     or new.is_junior is distinct from old.is_junior
     or new.parent_name is distinct from old.parent_name
     or new.parent_email is distinct from old.parent_email
     or new.parent_consent_at is distinct from old.parent_consent_at
     or new.email is distinct from old.email
     or new.season_goal_progress is distinct from old.season_goal_progress
     or new.anchor_word is distinct from old.anchor_word
     or new.current_module is distinct from old.current_module
     or new.gender is distinct from old.gender then
    raise exception 'Seule la coach peut modifier ces informations.';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- Vue « annuaire » du groupe : prénom et photo uniquement
create view public.member_directory with (security_invoker = false) as
  select p.id, p.first_name, p.gender, p.role, p.avatar_path
  from public.profiles p
  where p.status in ('active', 'alumni') and public.is_member();
grant select on public.member_directory to authenticated;

-- ---------------------------------------------------------------------
-- Check-ins hebdomadaires
-- ---------------------------------------------------------------------
create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  week_start date not null default public.week_start(),
  confidence smallint not null check (confidence between 1 and 10),
  stress smallint not null check (stress between 1 and 10),
  focus smallint not null check (focus between 1 and 10),
  motivation smallint not null check (motivation between 1 and 10),
  mind text,
  created_at timestamptz not null default now(),
  unique (rider_id, week_start)
);
create index on public.checkins (rider_id, week_start desc);

-- ---------------------------------------------------------------------
-- Objectifs de la semaine
-- ---------------------------------------------------------------------
create table public.weekly_goals (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  week_start date not null default public.week_start(),
  goals jsonb not null default '[]',          -- [{ "text": "...", "done": false }]
  process_goals jsonb not null default '[]',  -- [{ "text": "...", "done": false }]
  takeaway text,
  updated_at timestamptz not null default now(),
  unique (rider_id, week_start)
);

-- ---------------------------------------------------------------------
-- Concours et débriefs
-- ---------------------------------------------------------------------
create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  date date not null,
  location text not null default '',
  event text not null default '',
  height text not null default '',
  created_at timestamptz not null default now()
);
create index on public.competitions (rider_id, date);

create table public.debriefs (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  competition_id uuid references public.competitions (id) on delete set null,
  kind text not null default 'concours' check (kind in ('concours', 'cours')),
  date date not null default (now() at time zone 'Europe/Paris')::date,
  title text not null default '',
  result text check (result in ('sans_faute', '4_points', '8_points_plus', 'elimination', 'abandon')),
  mental_before text,
  mental_during text,
  mental_after text,
  went_well text,
  change_next text,
  coach_read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.debriefs (rider_id, date desc);

-- ---------------------------------------------------------------------
-- Routine (écrite par la coach, cochée par la cavalière)
-- ---------------------------------------------------------------------
create table public.routines (
  rider_id uuid primary key references public.profiles (id) on delete cascade,
  steps jsonb not null default '{"avant": [], "pendant": [], "apres": []}',  -- {phase: [{id, text}]}
  checked jsonb not null default '[]',  -- identifiants des étapes cochées
  updated_at timestamptz not null default now()
);

create or replace function public.guard_routine_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_coach() and new.steps is distinct from old.steps then
    raise exception 'Seule la coach peut modifier les étapes de la routine.';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger routines_guard before update on public.routines
  for each row execute function public.guard_routine_update();

create table public.routine_audios (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  path text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Séances, notes privées, demandes de rendez-vous
-- ---------------------------------------------------------------------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.profiles (id) on delete cascade,
  number int,
  theme text not null default '',
  scheduled_at timestamptz,
  visio_url text,
  prep text,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.sessions (rider_id, scheduled_at);

create table public.coach_notes (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid references public.sessions (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.appointment_requests (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  note text,
  status text not null default 'pending' check (status in ('pending', 'done')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Messagerie
-- thread_rider_id NULL = groupe Évolution ; sinon conversation privée
-- entre cette cavalière et Christina.
-- ---------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_rider_id uuid references public.profiles (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null default auth.uid(),
  kind text not null default 'text' check (kind in ('text', 'victory', 'auto')),
  body text,
  image_path text,
  audio_path text,
  audio_seconds int,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  check (body is not null or image_path is not null or audio_path is not null)
);
create index on public.messages (thread_rider_id, created_at desc);

create table public.read_state (
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  thread text not null,  -- 'group' ou l'identifiant de la cavalière
  last_read_at timestamptz not null default now(),
  primary key (user_id, thread)
);

-- ---------------------------------------------------------------------
-- Badges
-- ---------------------------------------------------------------------
create table public.badges (
  rider_id uuid not null references public.profiles (id) on delete cascade,
  code text not null,
  earned_at timestamptz not null default now(),
  primary key (rider_id, code)
);

-- ---------------------------------------------------------------------
-- Messages automatiques
-- ---------------------------------------------------------------------
create table public.auto_messages (
  code text primary key,
  label text not null,
  body text not null,
  enabled boolean not null default true,
  sort int not null default 0
);

insert into public.auto_messages (code, label, body, sort) values
  ('welcome', 'Arrivée d''une nouvelle cliente',
   'Bienvenue dans Évolution, {prenom} ! Je suis ravie de t''accompagner. Pense à ajouter l''appli sur ton écran d''accueil pour recevoir mes messages. Ta première séance : réserve ton créneau dans l''onglet Accueil, rubrique « Mes séances ». À très vite !', 1),
  ('tuesday_a', 'Chaque mardi (semaine A)',
   'Coucou {prenom}, comment s''est passée ta semaine ? Prends 2 minutes pour ton check-in et note tes objectifs de la semaine.', 2),
  ('tuesday_b', 'Chaque mardi (semaine B)',
   'Hello {prenom} ! Petit point de la semaine : comment tu te sens à cheval en ce moment ? Ton check-in t''attend.', 3),
  ('eve_competition', 'Veille d''un concours',
   'Demain c''est ton concours, {prenom} ! Relis ta routine « avant » ce soir et fais-toi confiance. Je suis avec toi.', 4),
  ('after_competition', 'Lendemain d''un concours',
   'Alors {prenom}, ce concours ? Prends 5 minutes pour ton débrief, à chaud c''est là qu''on apprend le plus.', 5),
  ('no_checkin_7d', '7 jours sans check-in',
   'Coucou {prenom}, je n''ai pas eu de tes nouvelles cette semaine. Tout va bien ? Ton check-in ne prend que 2 minutes.', 6),
  ('eve_session', 'Veille d''une séance',
   'Petit rappel {prenom} : notre séance, c''est demain à {heure}. {lien}', 7),
  ('end_starter', 'Fin de Starter 90',
   'Bravo {prenom} pour tout ce parcours Starter 90 ! On cale un bilan ensemble pour voir le chemin parcouru et la suite ?', 8);

create table public.auto_message_log (
  rider_id uuid not null references public.profiles (id) on delete cascade,
  code text not null,
  ref_key text not null,
  sent_at timestamptz not null default now(),
  primary key (rider_id, code, ref_key)
);

-- ---------------------------------------------------------------------
-- Notifications push
-- ---------------------------------------------------------------------
create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- RGPD : demandes de suppression
-- ---------------------------------------------------------------------
create table public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now()
);

-- Alertes coach mises de côté (« c'est fait »)
create table public.alert_dismissals (
  rider_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  ref_key text not null,
  created_at timestamptz not null default now(),
  primary key (rider_id, kind, ref_key)
);

-- =====================================================================
-- Règles de sécurité (RLS)
-- =====================================================================
alter table public.app_settings enable row level security;
create policy "réglages: lecture membres" on public.app_settings for select using (public.is_member());
create policy "réglages: coach" on public.app_settings for update using (public.is_coach());

-- Tables « données de la cavalière » : elle lit les siennes, écrit si active ; la coach fait tout.
do $$
declare t text;
begin
  foreach t in array array['checkins', 'weekly_goals', 'competitions', 'debriefs', 'appointment_requests'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "lecture" on public.%I for select using (rider_id = auth.uid() or public.is_coach())', t);
    execute format('create policy "ajout" on public.%I for insert with check ((rider_id = auth.uid() and public.is_active_rider()) or public.is_coach())', t);
    execute format('create policy "modif" on public.%I for update using ((rider_id = auth.uid() and public.is_active_rider()) or public.is_coach())', t);
    execute format('create policy "suppression" on public.%I for delete using ((rider_id = auth.uid() and public.is_active_rider()) or public.is_coach())', t);
  end loop;
end $$;

-- La cavalière ne peut pas marquer elle-même son débrief comme « lu par la coach »
create or replace function public.guard_debrief_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_coach() then
    new.coach_read_at := old.coach_read_at;
  end if;
  return new;
end $$;
create trigger debriefs_guard before update on public.debriefs
  for each row execute function public.guard_debrief_update();

alter table public.routines enable row level security;
create policy "routine: lecture" on public.routines for select using (rider_id = auth.uid() or public.is_coach());
create policy "routine: coach crée" on public.routines for insert with check (public.is_coach());
create policy "routine: cocher" on public.routines for update
  using ((rider_id = auth.uid() and public.is_active_rider()) or public.is_coach());

alter table public.routine_audios enable row level security;
create policy "audios: lecture" on public.routine_audios for select using (rider_id = auth.uid() or public.is_coach());
create policy "audios: coach" on public.routine_audios for all using (public.is_coach()) with check (public.is_coach());

alter table public.sessions enable row level security;
create policy "séances: lecture" on public.sessions for select using (rider_id = auth.uid() or public.is_coach());
create policy "séances: coach" on public.sessions for all using (public.is_coach()) with check (public.is_coach());

alter table public.coach_notes enable row level security;
create policy "notes privées: coach uniquement" on public.coach_notes for all using (public.is_coach()) with check (public.is_coach());

alter table public.messages enable row level security;
create policy "messages: lecture" on public.messages for select using (
  public.is_coach()
  or (thread_rider_id is null and public.is_member())
  or thread_rider_id = auth.uid()
);
create policy "messages: envoi" on public.messages for insert with check (
  sender_id = auth.uid() and (
    public.is_coach()
    or (thread_rider_id is null and public.is_member())
    or (thread_rider_id = auth.uid() and public.is_active_rider())
  )
);
create policy "messages: coach modifie (épingler)" on public.messages for update using (public.is_coach());
create policy "messages: supprimer le sien" on public.messages for delete using (sender_id = auth.uid() or public.is_coach());

-- Un seul message épinglé à la fois dans le groupe ; seuls les messages de la coach comptent
create or replace function public.guard_message_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Messages écrits par une cavalière : pas d'épingle, pas de faux « message automatique »
  if auth.uid() is not null and new.sender_id = auth.uid() and not public.is_coach() then
    new.pinned := false;
    if new.kind = 'auto' then new.kind := 'text'; end if;
  end if;
  return new;
end $$;
create trigger messages_guard before insert on public.messages
  for each row execute function public.guard_message_insert();

create or replace function public.single_pin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.pinned and new.thread_rider_id is null then
    update messages set pinned = false where pinned and thread_rider_id is null and id <> new.id;
  end if;
  return new;
end $$;
create trigger messages_single_pin after insert or update of pinned on public.messages
  for each row when (new.pinned) execute function public.single_pin();

alter table public.read_state enable row level security;
create policy "lu: soi-même" on public.read_state for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.badges enable row level security;
create policy "badges: lecture" on public.badges for select using (rider_id = auth.uid() or public.is_coach());
create policy "badges: coach" on public.badges for all using (public.is_coach()) with check (public.is_coach());

alter table public.auto_messages enable row level security;
create policy "auto: coach" on public.auto_messages for all using (public.is_coach()) with check (public.is_coach());

alter table public.auto_message_log enable row level security;
create policy "auto log: coach" on public.auto_message_log for select using (public.is_coach());

alter table public.push_subscriptions enable row level security;
create policy "push: soi-même" on public.push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.deletion_requests enable row level security;
create policy "suppression: lecture" on public.deletion_requests for select using (rider_id = auth.uid() or public.is_coach());
create policy "suppression: demande" on public.deletion_requests for insert with check (rider_id = auth.uid());
create policy "suppression: coach" on public.deletion_requests for delete using (public.is_coach());

alter table public.alert_dismissals enable row level security;
create policy "alertes: coach" on public.alert_dismissals for all using (public.is_coach()) with check (public.is_coach());

-- =====================================================================
-- Création automatique du profil
-- Le tout premier compte créé devient la coach. Les suivants sont des
-- cavalières invitées (leurs infos viennent de l'invitation).
-- =====================================================================
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}');
  is_first boolean := not exists (select 1 from profiles where role = 'coach');
begin
  insert into profiles (id, role, email, first_name, last_name, gender, program, program_start,
                        is_junior, parent_name, parent_email, parent_consent_at, activated_at)
  values (
    new.id,
    case when is_first then 'coach'::user_role else 'rider'::user_role end,
    new.email,
    coalesce(meta->>'first_name', case when is_first then 'Christina' else '' end),
    coalesce(meta->>'last_name', ''),
    coalesce(nullif(meta->>'gender', ''), 'f'),
    case when is_first then null else coalesce(nullif(meta->>'program', ''), 'starter90')::program_kind end,
    case when is_first then null else coalesce(nullif(meta->>'program_start', '')::date, current_date) end,
    coalesce((meta->>'is_junior')::boolean, false),
    meta->>'parent_name',
    meta->>'parent_email',
    case when (meta->>'parent_consent')::boolean then now() end,
    case when is_first then now() end
  );
  if not is_first then
    insert into routines (rider_id) values (new.id);
    -- Les 5 séances Starter 90, à réserver
    if coalesce(nullif(meta->>'program', ''), 'starter90') = 'starter90' then
      insert into sessions (rider_id, number, theme)
      select new.id, n, t from unnest(array['Objectifs', 'Concentration', 'Confiance en soi', 'Gestion des émotions', 'Plan d''action']) with ordinality as x(t, n);
    end if;
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Message de bienvenue : envoyé dans la conversation privée quand la
-- cavalière active son compte (première connexion + accord RGPD).
create or replace function public.on_rider_activated() returns trigger
language plpgsql security definer set search_path = public as $$
declare tpl record;
begin
  if new.role = 'rider' and old.activated_at is null and new.activated_at is not null then
    select * into tpl from auto_messages where code = 'welcome' and enabled;
    if found and public.coach_id() is not null then
      insert into messages (thread_rider_id, sender_id, kind, body)
      values (new.id, public.coach_id(), 'auto', public.fill_template(tpl.body, new.id, '{}'::jsonb));
      insert into auto_message_log (rider_id, code, ref_key) values (new.id, 'welcome', 'once')
        on conflict do nothing;
    end if;
  end if;
  return new;
end $$;

-- Remplace {prenom}, {cavaliere}, {heure}, {lien}… dans un modèle de message
create or replace function public.fill_template(tpl text, rider uuid, extra jsonb) returns text
language plpgsql stable security definer set search_path = public as $$
declare p record; out text := tpl; k text;
begin
  select * into p from profiles where id = rider;
  out := replace(out, '{prenom}', coalesce(p.first_name, ''));
  out := replace(out, '{cavaliere}', case when p.gender = 'm' then 'cavalier' else 'cavalière' end);
  for k in select jsonb_object_keys(extra) loop
    out := replace(out, '{' || k || '}', coalesce(extra->>k, ''));
  end loop;
  out := regexp_replace(out, '\{[a-z_]+\}', '', 'g');
  return trim(out);
end $$;

create trigger profiles_activated after update of activated_at on public.profiles
  for each row execute function public.on_rider_activated();

-- La cavalière active son compte (accord RGPD) — seule action autorisée sur ces champs
create or replace function public.activate_account() returns void
language sql security definer set search_path = public as $$
  update profiles set consent_at = coalesce(consent_at, now()), activated_at = coalesce(activated_at, now())
  where id = auth.uid();
$$;
grant execute on function public.activate_account() to authenticated;

-- =====================================================================
-- Badges automatiques
-- =====================================================================
create or replace function public.award_badge(rider uuid, badge text) returns void
language sql security definer set search_path = public as $$
  insert into badges (rider_id, code) values (rider, badge) on conflict do nothing;
$$;

create or replace function public.on_debrief_badges() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  select count(*) into n from debriefs where rider_id = new.rider_id;
  if n >= 1 then perform award_badge(new.rider_id, 'premier_pas'); end if;
  if n >= 5 then perform award_badge(new.rider_id, 'reflexive'); end if;
  if new.result = 'sans_faute' then perform award_badge(new.rider_id, 'sans_faute'); end if;
  return new;
end $$;
create trigger debriefs_badges after insert or update of result on public.debriefs
  for each row execute function public.on_debrief_badges();

create or replace function public.on_routine_badges() returns trigger
language plpgsql security definer set search_path = public as $$
declare total int; done int;
begin
  select count(*) into total from (
    select jsonb_array_elements(coalesce(new.steps->'avant', '[]') || coalesce(new.steps->'pendant', '[]') || coalesce(new.steps->'apres', '[]'))
  ) s;
  select count(*) into done from (
    select e->>'id' as id from jsonb_array_elements(coalesce(new.steps->'avant', '[]') || coalesce(new.steps->'pendant', '[]') || coalesce(new.steps->'apres', '[]')) e
    where new.checked ? (e->>'id')
  ) s;
  if total > 0 and done = total then perform award_badge(new.rider_id, 'routine'); end if;
  return new;
end $$;
create trigger routines_badges after update of checked on public.routines
  for each row execute function public.on_routine_badges();

-- La cavalière indique qu'elle a terminé son module de formation
create or replace function public.complete_module() returns void
language plpgsql security definer set search_path = public as $$
begin
  update profiles set modules_done = modules_done + 1 where id = auth.uid() and role = 'rider' and status = 'active';
  perform award_badge(auth.uid(), 'module');
end $$;
grant execute on function public.complete_module() to authenticated;

-- =====================================================================
-- Espace coach : alertes « à traiter en priorité »
-- =====================================================================
create or replace function public.coach_alerts()
returns table (rider_id uuid, kind text, ref_key text, detail text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare th jsonb; weeks jsonb;
begin
  if not public.is_coach() then
    raise exception 'Réservé à la coach';
  end if;
  select thresholds, program_weeks into th, weeks from app_settings;

  return query
  with riders as (
    select * from profiles where role = 'rider' and status = 'active'
  ),
  last_ci as (
    select distinct on (c.rider_id) c.* from checkins c order by c.rider_id, c.week_start desc
  ),
  alerts as (
    -- Confiance en baisse : -N points en deux semaines
    select l.rider_id, 'confidence_drop'::text as kind, l.id::text as ref_key,
           format('Sa confiance est passée de %s à %s en deux semaines.', prev.confidence, l.confidence) as detail,
           l.created_at
    from last_ci l
    join lateral (
      select c.confidence from checkins c
      where c.rider_id = l.rider_id and c.week_start >= l.week_start - 14 and c.week_start < l.week_start
      order by c.confidence desc limit 1
    ) prev on true
    where prev.confidence - l.confidence >= (th->>'confidence_drop')::int
      and l.week_start >= public.week_start() - 7

    union all
    -- Stress élevé
    select l.rider_id, 'stress_high', l.id::text,
           format('Stress à %s/10 dans son dernier check-in.', l.stress), l.created_at
    from last_ci l
    where l.stress >= (th->>'stress_high')::int and l.week_start >= public.week_start() - 7

    union all
    -- Décrochage : aucun check-in depuis N jours
    select r.id, 'dropout', coalesce(l.id::text, 'none'),
           case when l.id is null then format('Aucun check-in depuis son arrivée (%s jours).', current_date - r.program_start)
                else format('Aucun check-in depuis %s jours.', (current_date - (l.created_at at time zone 'Europe/Paris')::date)) end,
           coalesce(l.created_at, r.created_at)
    from riders r
    left join last_ci l on l.rider_id = r.id
    where coalesce((l.created_at at time zone 'Europe/Paris')::date, r.program_start, r.created_at::date)
          <= current_date - (th->>'no_checkin_days')::int

    union all
    -- Débrief à lire
    select d.rider_id, 'debrief_unread', d.id::text,
           format('A envoyé un débrief (%s) le %s.', case when d.kind = 'cours' then 'cours' else 'concours' end, to_char(d.date, 'DD/MM')),
           d.created_at
    from debriefs d join riders r on r.id = d.rider_id
    where d.coach_read_at is null

    union all
    -- Message privé sans réponse
    select m.thread_rider_id, 'message_waiting', m.id::text,
           'T''a écrit un message privé, encore sans réponse.', m.created_at
    from (
      select distinct on (thread_rider_id) * from messages
      where thread_rider_id is not null order by thread_rider_id, created_at desc
    ) m
    join riders r on r.id = m.thread_rider_id
    where m.sender_id = m.thread_rider_id

    union all
    -- Demande de rendez-vous
    select a.rider_id, 'appointment', a.id::text,
           coalesce('Demande un rendez-vous : ' || nullif(a.note, ''), 'Demande un rendez-vous.'), a.created_at
    from appointment_requests a join riders r on r.id = a.rider_id
    where a.status = 'pending'

    union all
    -- Fin de programme proche
    select r.id, 'program_end', r.program::text || ':' || r.program_start::text,
           case when r.program = 'starter90'
                then format('Termine Starter 90 le %s : bilan à caler et Level Up à proposer.', to_char(r.program_start + ((weeks->>'starter90')::int * 7), 'DD/MM'))
                else format('Termine Level Up 180 le %s : bilan à caler et Évolution Club à proposer.', to_char(r.program_start + ((weeks->>'levelup180')::int * 7), 'DD/MM')) end,
           now()
    from riders r
    where r.program in ('starter90', 'levelup180')
      and r.program_start + ((weeks->>(r.program::text))::int * 7) between current_date - 14 and current_date + (th->>'program_end_days')::int

    union all
    -- Demande de suppression des données (RGPD)
    select d.rider_id, 'deletion', d.id::text, 'Demande la suppression de son compte et de ses données.', d.created_at
    from deletion_requests d
  )
  select a.rider_id, a.kind, a.ref_key, a.detail, a.created_at from alerts a
  where not exists (
    select 1 from alert_dismissals x where x.rider_id = a.rider_id and x.kind = a.kind and x.ref_key = a.ref_key
  )
  order by a.created_at desc;
end $$;
grant execute on function public.coach_alerts() to authenticated;

-- =====================================================================
-- Fonctions internes (réservées aux fonctions serveur)
-- =====================================================================
create or replace function public.internal_config()
returns table (functions_url text, internal_secret text, vapid_public text, vapid_private text, vapid_subject text)
language sql security definer set search_path = private as $$
  select functions_url, internal_secret, vapid_public, vapid_private, vapid_subject from private.config;
$$;
revoke execute on function public.internal_config() from public, anon, authenticated;
grant execute on function public.internal_config() to service_role;

create or replace function public.internal_set_vapid(pub text, priv text) returns void
language sql security definer set search_path = private as $$
  update private.config set vapid_public = pub, vapid_private = priv where vapid_public is null;
$$;
revoke execute on function public.internal_set_vapid(text, text) from public, anon, authenticated;
grant execute on function public.internal_set_vapid(text, text) to service_role;

-- Appelle une fonction serveur (notifications, envois programmés)
create or replace function private.call_function(name text, payload jsonb) returns void
language plpgsql security definer set search_path = private, public as $$
declare cfg record;
begin
  select * into cfg from private.config;
  perform net.http_post(
    url := cfg.functions_url || '/' || name,
    body := payload,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', cfg.internal_secret),
    timeout_milliseconds := 10000
  );
end $$;

-- Notification à chaque nouveau message
create or replace function public.on_message_push() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform private.call_function('push', jsonb_build_object('type', 'message', 'message_id', new.id));
  return new;
end $$;
create trigger messages_push after insert on public.messages
  for each row execute function public.on_message_push();

-- Envois programmés : toutes les 15 minutes
select cron.schedule('evolution-scheduler', '*/15 * * * *',
  $$ select private.call_function('scheduler', '{}'::jsonb) $$);

-- =====================================================================
-- Temps réel (messagerie instantanée)
-- =====================================================================
alter publication supabase_realtime add table public.messages;

-- =====================================================================
-- Stockage des fichiers (photos, vocaux, audios de visualisation)
-- Tous privés. Chemins : <dossier>/<id cavalière ou "group">/<fichier>
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('avatars', 'avatars', false, 5242880),
       ('chat', 'chat', false, 26214400),
       ('audios', 'audios', false, 52428800)
on conflict (id) do nothing;

create policy "avatars: lecture membres" on storage.objects for select
  using (bucket_id = 'avatars' and public.is_member());
create policy "avatars: sa photo" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: remplacer sa photo" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "chat: lecture" on storage.objects for select using (
  bucket_id = 'chat' and (
    public.is_coach()
    or ((storage.foldername(name))[1] = 'group' and public.is_member())
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);
create policy "chat: envoi" on storage.objects for insert with check (
  bucket_id = 'chat' and (
    public.is_coach()
    or ((storage.foldername(name))[1] = 'group' and public.is_member())
    or ((storage.foldername(name))[1] = auth.uid()::text and public.is_active_rider())
  )
);

create policy "audios: lecture" on storage.objects for select using (
  bucket_id = 'audios' and (public.is_coach() or (storage.foldername(name))[1] = auth.uid()::text)
);
create policy "audios: coach dépose" on storage.objects for insert with check (bucket_id = 'audios' and public.is_coach());
create policy "audios: coach supprime" on storage.objects for delete using (bucket_id = 'audios' and public.is_coach());
