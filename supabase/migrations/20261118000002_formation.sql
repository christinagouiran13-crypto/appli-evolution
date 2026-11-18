-- =====================================================================
-- Espace « Ma formation » : modules Starter 90 (contenu sur Systemio)
-- =====================================================================
create table if not exists public.training_modules (
  id uuid primary key default gen_random_uuid(),
  program public.program_kind not null default 'starter90',
  position int not null,
  title text not null,
  weeks_label text not null default '',
  week_from int,
  week_to int,
  description text,
  lessons jsonb not null default '[]',   -- titres des leçons
  url text,                              -- lien direct vers le module sur Systemio (facultatif)
  created_at timestamptz not null default now()
);
alter table public.training_modules enable row level security;
create policy "formation: lecture membres" on public.training_modules for select using (public.is_member());
create policy "formation: coach" on public.training_modules for all using (public.is_coach()) with check (public.is_coach());

create table if not exists public.training_progress (
  rider_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  module_id uuid not null references public.training_modules (id) on delete cascade,
  done_at timestamptz not null default now(),
  primary key (rider_id, module_id)
);
alter table public.training_progress enable row level security;
create policy "progression: lecture" on public.training_progress for select using (rider_id = auth.uid() or public.is_coach());
create policy "progression: la sienne" on public.training_progress for insert with check (rider_id = auth.uid() and public.is_active_rider());
create policy "progression: retirer la sienne" on public.training_progress for delete using (rider_id = auth.uid() or public.is_coach());
create policy "progression: coach" on public.training_progress for insert with check (public.is_coach());

-- Module terminé : progression + badge « Module validé »
create or replace function public.on_training_done() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform award_badge(new.rider_id, 'module');
  update profiles set modules_done = (select count(*) from training_progress where rider_id = new.rider_id) where id = new.rider_id;
  return new;
end $$;
drop trigger if exists training_done on public.training_progress;
create trigger training_done after insert on public.training_progress
  for each row execute function public.on_training_done();

-- Contenu Starter 90 (repris de Systemio)
insert into public.training_modules (program, position, title, weeks_label, week_from, week_to, lessons)
select 'starter90', v.pos, v.title, v.weeks, v.wf, v.wt, v.lessons::jsonb from (values
  (0, 'Introduction : documents à voir avant de démarrer', 'Avant de commencer', 0, 0,
   '["Introduction au programme", "Comment bien suivre ta formation", "Réussite vs échec", "Personnalise ta préparation mentale"]'),
  (1, 'Module 1 : Établir des bases mentales solides', 'Semaines 1 et 2', 1, 2,
   '["Auto-évaluation", "Les 4 niveaux d''objectif", "Construire une résilience mentale"]'),
  (2, 'Module 2 : Développer la concentration', 'Semaines 3 et 4', 3, 4,
   '["Avant de commencer : passer le test de conscience et d''attention", "Techniques pour améliorer la concentration", "Gérer les distractions et maintenir un esprit compétitif", "Pratiques quotidiennes pour renforcer la clarté mentale", "Prendre rdv pour ta deuxième séance"]'),
  (3, 'Bonus : avant d''attaquer le travail sur la confiance', 'Semaine 5', 5, 5,
   '["Le regard des autres", "L''effet cumulé", "Les 5 secondes", "Les 45 secondes avant le départ"]'),
  (4, 'Module 3 : Renforcer la confiance', 'Semaines 6 et 7', 6, 7,
   '["Avant de commencer", "Forces, qualités et compétences", "Ton arbre de réussite", "Surmonter les doutes et la peur de l''échec", "Créer un cadre mental positif", "Exercices de visualisation pour la confiance en compétition", "Prendre rdv pour ta troisième séance"]'),
  (5, 'Module 4 : Gestion des émotions', 'Semaines 8 et 9', 8, 9,
   '["Avant de commencer : passer le test de l''échelle de difficulté émotionnelle", "Gérer les émotions dans les situations de forte pression", "L''ancrage", "Techniques de récupération émotionnelle après des échecs", "Prendre rdv pour ton quatrième coaching"]'),
  (6, 'Module 5 : Optimisation de la routine', 'Semaines 10 et 11', 10, 11,
   '["Établir des routines avant et pendant la compétition", "Préparation mentale avant et après chaque événement", "Intégrer l''entraînement mental dans la vie quotidienne", "Prendre rdv pour ta dernière séance"]'),
  (7, 'Module 6 : Évaluation, ajustement et conclusion', 'Fin du programme', 12, 12,
   '["Évaluation et ajustement", "Comment maintenir et développer tes compétences au-delà des 90 jours"]')
) as v(pos, title, weeks, wf, wt, lessons)
where not exists (select 1 from public.training_modules where program = 'starter90');
