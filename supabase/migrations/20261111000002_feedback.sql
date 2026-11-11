-- =====================================================================
-- Questionnaire de feedback après concours (7 questions de Christina)
-- =====================================================================
create table if not exists public.competition_feedback (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  competition_id uuid references public.competitions (id) on delete set null,
  date date not null default (now() at time zone 'Europe/Paris')::date,
  title text not null default '',
  answers jsonb not null default '{}',
  coach_read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists competition_feedback_rider on public.competition_feedback (rider_id, date desc);

alter table public.competition_feedback enable row level security;
create policy "feedback: lecture" on public.competition_feedback for select using (rider_id = auth.uid() or public.is_coach());
create policy "feedback: ajout" on public.competition_feedback for insert with check ((rider_id = auth.uid() and public.is_active_rider()) or public.is_coach());
create policy "feedback: modif" on public.competition_feedback for update using ((rider_id = auth.uid() and public.is_active_rider()) or public.is_coach());
create policy "feedback: suppression" on public.competition_feedback for delete using (public.is_coach());

create or replace function public.guard_feedback_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_coach() then
    new.coach_read_at := old.coach_read_at;
  end if;
  return new;
end $$;
create trigger competition_feedback_guard before update on public.competition_feedback
  for each row execute function public.guard_feedback_update();

-- Alerte coach : feedback à lire
create or replace function public.coach_feedback_alerts()
returns table (rider_id uuid, kind text, ref_key text, detail text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select f.rider_id, 'feedback_unread', f.id::text,
         format('A rempli son questionnaire de feedback (%s).', coalesce(nullif(f.title, ''), to_char(f.date, 'DD/MM'))),
         f.created_at
  from competition_feedback f join profiles p on p.id = f.rider_id
  where public.is_coach() and f.coach_read_at is null and p.status <> 'archived'
    and not exists (select 1 from alert_dismissals x where x.rider_id = f.rider_id and x.kind = 'feedback_unread' and x.ref_key = f.id::text);
$$;
grant execute on function public.coach_feedback_alerts() to authenticated;

-- Le message du lendemain de concours invite au débrief et au feedback
update public.auto_messages set
  body = 'Alors {prenom}, ce concours ? Prends quelques minutes pour ton débrief et ton questionnaire de feedback : à chaud, c''est là qu''on apprend le plus.'
where code = 'after_competition';
