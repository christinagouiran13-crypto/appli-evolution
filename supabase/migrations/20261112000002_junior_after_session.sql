-- =====================================================================
-- Juniors : la mission N part APRÈS la séance N, avec le message de
-- Christina et le PDF. À la réservation : simple confirmation.
-- =====================================================================
alter table public.junior_missions add column if not exists after_message text not null default '';
alter table public.junior_missions add column if not exists pdf_path text;

update public.junior_missions set after_message = v.msg
from (values
  (0, 'Coucou {prenom} ! 🐴 Merci pour notre première séance ! Voici ta mission jusqu''à la prochaine fois : 3 petits exercices tout simples. Envoie-moi tes photos quand c''est fait. 💚'),
  (1, 'Hello {prenom} ! Bravo pour cette séance ✨ Ta mission : dessiner ton grand rêve et ton escalier. J''ai hâte de voir ça !'),
  (2, 'Coucou {prenom} ! On entraîne ta concentration 🎯 Respiration carrée, mot-clé et le film dans ta tête. Dis-moi quel mot tu as choisi !'),
  (3, 'Hello {prenom} ! Cette fois, on remplit ta confiance comme une tirelire 🫙 Envoie-moi une photo de ton pot avant notre séance !'),
  (4, 'Coucou {prenom} ! On apprend à calmer les émotions qui montent 🌡️ Teste la règle des 3 secondes et raconte-moi !'),
  (5, 'Hello {prenom} ! Dernière mission 🏅 Construis ta routine, teste-la et refais tes notes sur 10. Tu vas voir tout le chemin parcouru, je suis tellement fière de toi ! 💚')
) as v(pos, msg)
where junior_missions.position = v.pos and junior_missions.after_message = '';

-- Missions reçues par chaque junior (rubrique « Mes missions »)
create table if not exists public.junior_mission_sent (
  rider_id uuid not null references public.profiles (id) on delete cascade,
  mission_id uuid not null references public.junior_missions (id) on delete cascade,
  session_id uuid references public.sessions (id) on delete set null,
  sent_at timestamptz not null default now(),
  primary key (rider_id, mission_id)
);
alter table public.junior_mission_sent enable row level security;
create policy "missions reçues: lecture" on public.junior_mission_sent for select using (rider_id = auth.uid() or public.is_coach());
create policy "missions reçues: coach" on public.junior_mission_sent for all using (public.is_coach()) with check (public.is_coach());

update public.auto_messages set
  label = 'Juniors : après la séance (mission)',
  body = '{message}

{mission}

Ta mission est aussi rangée dans Indispensables, rubrique « Mes missions ».'
where code = 'junior_mission';

insert into public.auto_messages (code, label, body, sort) values
  ('junior_booked', 'Juniors : séance réservée', 'Ta séance {numero} est réservée{quand} ! À très vite {prenom} 💚', 11)
on conflict (code) do nothing;

-- Envoi de la mission N après la séance N (une seule fois)
create or replace function public.deliver_junior_mission(sid uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare s record; p record; tpl record; m record; txt text; n int;
begin
  select * into s from sessions where id = sid;
  if not found then return false; end if;
  select * into p from profiles where id = s.rider_id;
  if not p.is_junior or p.status <> 'active' or p.activated_at is null then return false; end if;
  select * into tpl from auto_messages where code = 'junior_mission' and enabled;
  if not found or public.coach_id() is null then return false; end if;
  select * into m from junior_missions order by position, created_at
    offset greatest(coalesce(s.number, 1) - 1, 0) limit 1;
  if m.id is null then return false; end if;

  insert into auto_message_log (rider_id, code, ref_key) values (s.rider_id, 'junior_after', s.id::text)
  on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then return false; end if;

  txt := public.fill_template(tpl.body, s.rider_id, jsonb_build_object(
    'message', public.fill_template(coalesce(nullif(m.after_message, ''), 'Coucou {prenom} ! Voici ta nouvelle mission.'), s.rider_id, '{}'::jsonb),
    'mission', m.title || coalesce(E'\n\n' || nullif(m.body, ''), ''),
    'numero', coalesce(s.number::text, '')));
  insert into messages (thread_rider_id, sender_id, kind, body) values (s.rider_id, public.coach_id(), 'auto', txt);
  insert into junior_mission_sent (rider_id, mission_id, session_id) values (s.rider_id, m.id, s.id) on conflict do nothing;
  perform private.call_function('push', jsonb_build_object(
    'type', 'notify', 'user_id', s.rider_id, 'pref', 'session',
    'title', 'Christina', 'body', left(txt, 120), 'url', '/indispensables'));
  return true;
end $$;
revoke execute on function public.deliver_junior_mission(uuid) from public, anon, authenticated;
grant execute on function public.deliver_junior_mission(uuid) to service_role;

-- À la réservation : simple confirmation (juniors)
create or replace function public.on_session_booked() returns trigger
language plpgsql security definer set search_path = public as $$
declare p record; tpl record; txt text; n int; quand text := '';
begin
  -- Séance marquée « faite » : la mission part tout de suite
  if tg_op = 'UPDATE' and new.done and not old.done then
    perform public.deliver_junior_mission(new.id);
    return new;
  end if;
  if new.done then return new; end if;
  if not (new.booked_at is not null and (tg_op = 'INSERT' or old.booked_at is null)) then return new; end if;

  select * into p from profiles where id = new.rider_id;
  if not p.is_junior or p.status <> 'active' or p.activated_at is null then return new; end if;
  select * into tpl from auto_messages where code = 'junior_booked' and enabled;
  if not found or public.coach_id() is null then return new; end if;

  insert into auto_message_log (rider_id, code, ref_key) values (new.rider_id, 'junior_booked', new.id::text)
  on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then return new; end if;

  if new.scheduled_at is not null then
    quand := ' pour le ' || to_char(new.scheduled_at at time zone 'Europe/Paris', 'DD/MM')
          || ' à ' || to_char(new.scheduled_at at time zone 'Europe/Paris', 'HH24"h"MI');
  end if;
  txt := public.fill_template(tpl.body, new.rider_id, jsonb_build_object('numero', coalesce(new.number::text, ''), 'quand', quand));
  insert into messages (thread_rider_id, sender_id, kind, body) values (new.rider_id, public.coach_id(), 'auto', txt);
  perform private.call_function('push', jsonb_build_object(
    'type', 'notify', 'user_id', new.rider_id, 'pref', 'session',
    'title', 'Christina', 'body', left(txt, 120), 'url', '/seances'));
  return new;
end $$;
drop trigger if exists sessions_booked on public.sessions;
create trigger sessions_booked after insert or update of booked_at, done on public.sessions
  for each row execute function public.on_session_booked();
