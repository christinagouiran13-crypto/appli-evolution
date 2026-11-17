-- =====================================================================
-- Accompagnement terminé (date de fin dépassée) : pas d'alerte « décrochage ».
-- Les messages automatiques sont aussi coupés (fonction scheduler).
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
      -- pas de relance si l'accompagnement est terminé
      and not (r.program in ('starter90', 'levelup180') and r.program_start is not null
               and current_date > r.program_start + ((weeks->>(r.program::text))::int * 7))

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
