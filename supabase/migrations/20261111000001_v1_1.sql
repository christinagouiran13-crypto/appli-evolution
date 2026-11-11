-- =====================================================================
-- Version 1.1 : indispensables, bouton urgence, vidéos, routine
-- construite par la cavalière, rappels de séance, missions junior.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Messages : vidéos et messages urgents
-- ---------------------------------------------------------------------
alter table public.messages add column if not exists video_path text;
alter table public.messages drop constraint if exists messages_check;
alter table public.messages add constraint messages_content_check
  check (body is not null or image_path is not null or audio_path is not null or video_path is not null);
alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check
  check (kind in ('text', 'victory', 'auto', 'urgent'));

-- Une cavalière ne peut envoyer un message urgent que dans sa conversation privée
create or replace function public.guard_message_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and new.sender_id = auth.uid() and not public.is_coach() then
    new.pinned := false;
    if new.kind = 'auto' then new.kind := 'text'; end if;
    if new.kind = 'urgent' and new.thread_rider_id is distinct from auth.uid() then new.kind := 'text'; end if;
  end if;
  return new;
end $$;

-- Vidéos : jusqu'à 50 Mo (limite de l'offre gratuite de Supabase)
update storage.buckets set file_size_limit = 52428800 where id = 'chat';

-- ---------------------------------------------------------------------
-- Boîte de secours : partie commune + partie personnelle
-- ---------------------------------------------------------------------
alter table public.app_settings add column if not exists rescue_text text not null default
'Respire : inspire 4 secondes, bloque 4 secondes, expire 6 secondes. Recommence 3 fois.
Repense à ton mot d''ancrage et à ton plus beau parcours.
Concentre-toi sur ce que tu contrôles : ta respiration, ton regard, ta routine.
Tu as le droit d''avoir peur. Tu as aussi tout ce qu''il faut pour y aller.';
alter table public.profiles add column if not exists rescue_text text;

-- ---------------------------------------------------------------------
-- Missions junior (une tous les 15 jours)
-- ---------------------------------------------------------------------
create table if not exists public.junior_missions (
  id uuid primary key default gen_random_uuid(),
  position int not null default 0,
  title text not null,
  body text not null default '',
  created_at timestamptz not null default now()
);
alter table public.junior_missions enable row level security;
create policy "missions: lecture membres" on public.junior_missions for select using (public.is_member());
create policy "missions: coach" on public.junior_missions for all using (public.is_coach()) with check (public.is_coach());

alter table public.profiles add column if not exists junior_mission_index int not null default 0;

-- La cavalière ne modifie pas sa boîte de secours personnelle ni ses missions
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
     or new.gender is distinct from old.gender
     or new.rescue_text is distinct from old.rescue_text
     or new.junior_mission_index is distinct from old.junior_mission_index then
    raise exception 'Seule la coach peut modifier ces informations.';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Routine : la cavalière la construit elle-même (la coach aussi)
-- ---------------------------------------------------------------------
create or replace function public.guard_routine_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Ressources : fichiers, audios, liens (communs ou pour une cliente)
-- rider_id NULL = pour tout le monde
-- ---------------------------------------------------------------------
create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid references public.profiles (id) on delete cascade,
  category text not null default 'fichier' check (category in ('audio', 'fichier', 'lien', 'feedback')),
  title text not null,
  description text,
  path text,
  url text,
  created_at timestamptz not null default now()
);
alter table public.resources enable row level security;
create policy "ressources: lecture" on public.resources for select
  using (public.is_coach() or (rider_id is null and public.is_member()) or rider_id = auth.uid());
create policy "ressources: coach" on public.resources for all using (public.is_coach()) with check (public.is_coach());

insert into storage.buckets (id, name, public, file_size_limit)
values ('resources', 'resources', false, 52428800)
on conflict (id) do nothing;

create policy "ressources: lecture fichiers" on storage.objects for select using (
  bucket_id = 'resources' and (
    public.is_coach()
    or ((storage.foldername(name))[1] = 'commun' and public.is_member())
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);
create policy "ressources: coach dépose" on storage.objects for insert with check (bucket_id = 'resources' and public.is_coach());
create policy "ressources: coach supprime" on storage.objects for delete using (bucket_id = 'resources' and public.is_coach());

-- ---------------------------------------------------------------------
-- Messages automatiques : fin de Starter une semaine avant, rappel de
-- séance tous les 15 jours, mission junior tous les 15 jours
-- ---------------------------------------------------------------------
update public.auto_messages set
  label = 'Une semaine avant la fin de Starter 90',
  body = 'Coucou {prenom}, ton accompagnement Starter 90 se termine dans une semaine ! On cale un bilan ensemble pour voir tout le chemin parcouru et la suite ?'
where code = 'end_starter';

insert into public.auto_messages (code, label, body, sort) values
  ('session_reminder', 'Rappel de séance (tous les 15 jours)',
   'Coucou {prenom}, pense à réserver ta prochaine séance avec moi : tout se passe dans l''onglet Accueil, rubrique « Mes séances ».', 9),
  ('junior_mission', 'Juniors : confirmation de séance + mission',
   'Ta séance {numero} est confirmée le {date} à {heure} ! Ta mission pour la préparer : {mission}', 10)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- Alertes coach : message urgent en tête de liste
-- ---------------------------------------------------------------------
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
    -- URGENCE : demande d'aide pendant un concours
    select m.thread_rider_id as rider_id, 'urgent'::text as kind, m.id::text as ref_key,
           coalesce('URGENCE : ' || nullif(m.body, ''), 'URGENCE : a besoin de toi rapidement.') as detail,
           m.created_at
    from messages m
    where m.kind = 'urgent' and m.created_at > now() - interval '3 days'

    union all
    select l.rider_id, 'confidence_drop', l.id::text,
           format('Sa confiance est passée de %s à %s en deux semaines.', prev.confidence, l.confidence),
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
    select l.rider_id, 'stress_high', l.id::text,
           format('Stress à %s/10 dans son dernier check-in.', l.stress), l.created_at
    from last_ci l
    where l.stress >= (th->>'stress_high')::int and l.week_start >= public.week_start() - 7

    union all
    select r.id, 'dropout', coalesce(l.id::text, 'none'),
           case when l.id is null then format('Aucun check-in depuis son arrivée (%s jours).', current_date - r.program_start)
                else format('Aucun check-in depuis %s jours.', (current_date - (l.created_at at time zone 'Europe/Paris')::date)) end,
           coalesce(l.created_at, r.created_at)
    from riders r
    left join last_ci l on l.rider_id = r.id
    where coalesce((l.created_at at time zone 'Europe/Paris')::date, r.program_start, r.created_at::date)
          <= current_date - (th->>'no_checkin_days')::int

    union all
    select d.rider_id, 'debrief_unread', d.id::text,
           format('A envoyé un débrief (%s) le %s.', case when d.kind = 'cours' then 'cours' else 'concours' end, to_char(d.date, 'DD/MM')),
           d.created_at
    from debriefs d join riders r on r.id = d.rider_id
    where d.coach_read_at is null

    union all
    select m.thread_rider_id, 'message_waiting', m.id::text,
           'T''a écrit un message privé, encore sans réponse.', m.created_at
    from (
      select distinct on (thread_rider_id) * from messages
      where thread_rider_id is not null order by thread_rider_id, created_at desc
    ) m
    join riders r on r.id = m.thread_rider_id
    where m.sender_id = m.thread_rider_id and m.kind <> 'urgent'

    union all
    select a.rider_id, 'appointment', a.id::text,
           coalesce('Demande un rendez-vous : ' || nullif(a.note, ''), 'Demande un rendez-vous.'), a.created_at
    from appointment_requests a join riders r on r.id = a.rider_id
    where a.status = 'pending'

    union all
    select r.id, 'program_end', r.program::text || ':' || r.program_start::text,
           case when r.program = 'starter90'
                then format('Termine Starter 90 le %s : bilan à caler et Level Up à proposer.', to_char(r.program_start + ((weeks->>'starter90')::int * 7), 'DD/MM'))
                else format('Termine Level Up 180 le %s : bilan à caler et Évolution Club à proposer.', to_char(r.program_start + ((weeks->>'levelup180')::int * 7), 'DD/MM')) end,
           now()
    from riders r
    where r.program in ('starter90', 'levelup180')
      and r.program_start + ((weeks->>(r.program::text))::int * 7) between current_date - 14 and current_date + (th->>'program_end_days')::int

    union all
    select d.rider_id, 'deletion', d.id::text, 'Demande la suppression de son compte et de ses données.', d.created_at
    from deletion_requests d
  )
  select a.rider_id, a.kind, a.ref_key, a.detail, a.created_at from alerts a
  where not exists (
    select 1 from alert_dismissals x where x.rider_id = a.rider_id and x.kind = a.kind and x.ref_key = a.ref_key
  )
  order by (a.kind = 'urgent') desc, a.created_at desc;
end $$;

-- =====================================================================
-- Inscription autonome des clientes (lien d'inscription à partager)
-- =====================================================================
alter table public.app_settings add column if not exists signup_code text not null
  default encode(extensions.gen_random_bytes(9), 'hex');
alter table public.profiles add column if not exists self_signup boolean not null default false;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}');
  is_first boolean := not exists (select 1 from profiles where role = 'coach');
  prog text := nullif(meta->>'program', '');
  st text := coalesce(nullif(meta->>'status', ''), 'active');
begin
  if prog = 'termine' then prog := null; st := 'alumni'; end if;
  insert into profiles (id, role, email, first_name, last_name, gender, program, program_start, status,
                        is_junior, parent_name, parent_email, parent_consent_at, activated_at, self_signup)
  values (
    new.id,
    case when is_first then 'coach'::user_role else 'rider'::user_role end,
    new.email,
    coalesce(meta->>'first_name', case when is_first then 'Christina' else '' end),
    coalesce(meta->>'last_name', ''),
    coalesce(nullif(meta->>'gender', ''), 'f'),
    case when is_first then null when st = 'alumni' then prog::program_kind else coalesce(prog, 'starter90')::program_kind end,
    case when is_first then null else coalesce(nullif(meta->>'program_start', '')::date, current_date) end,
    case when is_first then 'active'::member_status else st::member_status end,
    coalesce((meta->>'is_junior')::boolean, false),
    meta->>'parent_name',
    meta->>'parent_email',
    case when (meta->>'parent_consent')::boolean then now() end,
    case when is_first then now() end,
    coalesce((meta->>'self_signup')::boolean, false)
  );
  if not is_first then
    insert into routines (rider_id) values (new.id);
    if st = 'active' and coalesce(prog, 'starter90') = 'starter90' then
      insert into sessions (rider_id, number, theme)
      select new.id, n, t from unnest(array['Objectifs', 'Concentration', 'Confiance en soi', 'Gestion des émotions', 'Plan d''action']) with ordinality as x(t, n);
    end if;
  end if;
  return new;
end $$;

-- Le message de bienvenue ne part qu'aux clientes en cours d'accompagnement
create or replace function public.on_rider_activated() returns trigger
language plpgsql security definer set search_path = public as $$
declare tpl record;
begin
  if new.role = 'rider' and new.status = 'active' and old.activated_at is null and new.activated_at is not null then
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

-- =====================================================================
-- Juniors : quand une séance est notée, confirmation + mission du même numéro
-- =====================================================================
update public.auto_messages set
  label = 'Juniors : confirmation de séance + mission',
  body = 'Ta séance {numero} est confirmée le {date} à {heure} ! Ta mission pour la préparer : {mission}'
where code = 'junior_mission';

create or replace function public.on_session_booked() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p record; tpl record; m record; extra jsonb; txt text; n int;
begin
  if new.scheduled_at is null or new.scheduled_at < now() or new.done then return new; end if;
  if tg_op = 'UPDATE' and old.scheduled_at is not distinct from new.scheduled_at then return new; end if;
  select * into p from profiles where id = new.rider_id;
  if not p.is_junior or p.status <> 'active' or p.activated_at is null then return new; end if;
  select * into tpl from auto_messages where code = 'junior_mission' and enabled;
  if not found or public.coach_id() is null then return new; end if;

  insert into auto_message_log (rider_id, code, ref_key)
  values (new.rider_id, 'junior_session', new.id::text || '@' || new.scheduled_at::text)
  on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then return new; end if;

  select * into m from junior_missions order by position, created_at
    offset greatest(coalesce(new.number, 1) - 1, 0) limit 1;
  extra := jsonb_build_object(
    'numero', coalesce(new.number::text, ''),
    'date', to_char(new.scheduled_at at time zone 'Europe/Paris', 'DD/MM'),
    'heure', to_char(new.scheduled_at at time zone 'Europe/Paris', 'HH24"h"MI'),
    'mission', case when m.id is null then '' else m.title || coalesce(' — ' || nullif(m.body, ''), '') end
  );
  txt := public.fill_template(tpl.body, new.rider_id, extra);
  if m.id is null then
    txt := regexp_replace(txt, '\s*Ta mission pour la préparer :\s*$', ' À très vite !');
  end if;
  insert into messages (thread_rider_id, sender_id, kind, body) values (new.rider_id, public.coach_id(), 'auto', txt);
  perform private.call_function('push', jsonb_build_object(
    'type', 'notify', 'user_id', new.rider_id, 'pref', 'session',
    'title', 'Christina', 'body', left(txt, 120), 'url', '/messages?fil=coach'));
  return new;
end $$;
drop trigger if exists sessions_booked on public.sessions;
create trigger sessions_booked after insert or update of scheduled_at on public.sessions
  for each row execute function public.on_session_booked();

-- Alerte : nouvelle inscription à vérifier (programme, date de début)
create or replace function public.coach_new_signups()
returns table (rider_id uuid, kind text, ref_key text, detail text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, 'new_signup', p.id::text,
         'S''est inscrite toute seule : vérifie son programme et sa date de début.', p.created_at
  from profiles p
  where public.is_coach() and p.self_signup and p.status <> 'archived'
    and p.created_at > now() - interval '60 days'
    and not exists (select 1 from alert_dismissals x where x.rider_id = p.id and x.kind = 'new_signup' and x.ref_key = p.id::text);
$$;
grant execute on function public.coach_new_signups() to authenticated;
