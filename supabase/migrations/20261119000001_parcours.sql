-- =====================================================================
-- « Ton parcours Évolution » : présentation des programmes suivants
-- (textes modifiables par Christina dans Indispensables)
-- =====================================================================
alter table public.app_settings add column if not exists offers jsonb not null default '{
  "starter90": {"title": "Starter 90", "tagline": "Les bases de ton mental de compétitrice", "description": "3 mois pour poser des bases solides : objectifs, concentration, confiance, émotions et routine, avec 5 séances avec Christina."},
  "levelup180": {"title": "Level Up 180", "tagline": "La suite pour passer un cap", "description": "6 mois pour aller plus loin : une séance par mois avec Christina et des exercices pour progresser en concours, saison après saison."},
  "club": {"title": "Évolution Club", "tagline": "Rester dans l''équipe", "description": "Garde ton suivi, le groupe Équipe Évolution, les défis et l''appli, sans date de fin. Pour continuer à progresser entourée."}
}';

-- « Ça m'intéresse » : possible aussi pour les anciennes clientes
create table if not exists public.offer_interests (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.profiles (id) on delete cascade,
  program public.program_kind not null,
  created_at timestamptz not null default now()
);
alter table public.offer_interests enable row level security;
create policy "intérêts: lecture" on public.offer_interests for select using (rider_id = auth.uid() or public.is_coach());

create or replace function public.express_interest(prog public.program_kind) returns void
language plpgsql security definer set search_path = public as $$
declare me record; o jsonb;
begin
  select * into me from profiles where id = auth.uid();
  if not found or me.role <> 'rider' or me.status = 'archived' then raise exception 'Non autorisé'; end if;
  select offers->(prog::text) into o from app_settings;
  insert into offer_interests (rider_id, program) values (me.id, prog);
  insert into messages (thread_rider_id, sender_id, body)
  values (me.id, me.id, format('Je suis %s par %s ! Tu peux m''en dire plus ?',
          case when me.gender = 'm' then 'intéressé' else 'intéressée' end, coalesce(o->>'title', prog::text)));
end $$;
grant execute on function public.express_interest(public.program_kind) to authenticated;

create or replace function public.coach_interest_alerts()
returns table (rider_id uuid, kind text, ref_key text, detail text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select i.rider_id, 'interest', i.id::text,
         format('Intéressée par %s : propose-lui un appel.', coalesce((select offers->(i.program::text)->>'title' from app_settings), i.program::text)),
         i.created_at
  from offer_interests i
  where public.is_coach()
    and not exists (select 1 from alert_dismissals x where x.rider_id = i.rider_id and x.kind = 'interest' and x.ref_key = i.id::text);
$$;
grant execute on function public.coach_interest_alerts() to authenticated;
