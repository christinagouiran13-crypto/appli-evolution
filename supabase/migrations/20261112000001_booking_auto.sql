-- =====================================================================
-- Réservation automatique : quand la cliente réserve sur Calendly depuis
-- l'appli, la séance suivante est marquée réservée toute seule
-- (et la mission suivante part pour les juniors).
-- =====================================================================
alter table public.sessions add column if not exists booked_at timestamptz;
alter table public.sessions add column if not exists calendly_event_uri text unique;

update public.auto_messages set
  body = 'Ta séance {numero} est réservée{quand} ! Voici ta mission pour la préparer :

{mission}

Une question ? Écris-moi, je suis là.'
where code = 'junior_mission';

create or replace function public.on_session_booked() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p record; tpl record; m record; extra jsonb; txt text; n int; quand text := '';
begin
  if new.done then return new; end if;
  -- Déclencheurs : la séance vient d'être réservée, ou une date future vient d'être notée
  if not (
    (new.booked_at is not null and (tg_op = 'INSERT' or old.booked_at is null))
    or (new.scheduled_at is not null and new.scheduled_at >= now()
        and (tg_op = 'INSERT' or old.scheduled_at is distinct from new.scheduled_at))
  ) then return new; end if;

  select * into p from profiles where id = new.rider_id;
  if not p.is_junior or p.status <> 'active' or p.activated_at is null then return new; end if;
  select * into tpl from auto_messages where code = 'junior_mission' and enabled;
  if not found or public.coach_id() is null then return new; end if;

  -- Une seule mission par séance (un report de date ne renvoie pas la mission)
  insert into auto_message_log (rider_id, code, ref_key)
  values (new.rider_id, 'junior_session', new.id::text)
  on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then return new; end if;

  if new.scheduled_at is not null then
    quand := ' pour le ' || to_char(new.scheduled_at at time zone 'Europe/Paris', 'DD/MM')
          || ' à ' || to_char(new.scheduled_at at time zone 'Europe/Paris', 'HH24"h"MI');
  end if;
  select * into m from junior_missions order by position, created_at
    offset greatest(coalesce(new.number, 1) - 1, 0) limit 1;
  extra := jsonb_build_object(
    'numero', coalesce(new.number::text, ''),
    'quand', quand,
    'date', coalesce(to_char(new.scheduled_at at time zone 'Europe/Paris', 'DD/MM'), ''),
    'heure', coalesce(to_char(new.scheduled_at at time zone 'Europe/Paris', 'HH24"h"MI'), ''),
    'mission', case when m.id is null then '' else m.title || coalesce(E'\n\n' || nullif(m.body, ''), '') end
  );
  if m.id is null then
    txt := public.fill_template('Ta séance {numero} est réservée{quand} ! À très vite.', new.rider_id, extra);
  else
    txt := public.fill_template(tpl.body, new.rider_id, extra);
  end if;
  insert into messages (thread_rider_id, sender_id, kind, body) values (new.rider_id, public.coach_id(), 'auto', txt);
  perform private.call_function('push', jsonb_build_object(
    'type', 'notify', 'user_id', new.rider_id, 'pref', 'session',
    'title', 'Christina', 'body', left(txt, 120), 'url', '/messages?fil=coach'));
  return new;
end $$;
drop trigger if exists sessions_booked on public.sessions;
create trigger sessions_booked after insert or update of scheduled_at, booked_at on public.sessions
  for each row execute function public.on_session_booked();
