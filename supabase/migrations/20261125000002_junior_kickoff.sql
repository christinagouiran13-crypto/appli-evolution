-- Envoi unique demandé par Christina : prendre des nouvelles des juniors en cours
-- (une seule fois par junior, pas pendant une pause). Message envoyé en son nom,
-- avec notification.
with juniors as (
  select p.id, p.first_name from public.profiles p
  where p.role = 'rider' and p.is_junior and p.status = 'active' and p.activated_at is not null
    and (p.pause_until is null or p.pause_until < current_date)
),
logged as (
  insert into public.auto_message_log (rider_id, code, ref_key)
  select id, 'junior_kickoff', 'once' from juniors
  on conflict do nothing
  returning rider_id
)
insert into public.messages (thread_rider_id, sender_id, kind, body)
select j.id, public.coach_id(), 'text', 'Coucou ' || j.first_name || ', comment ça va cette semaine ? 💚'
from juniors j join logged l on l.rider_id = j.id
where public.coach_id() is not null;
