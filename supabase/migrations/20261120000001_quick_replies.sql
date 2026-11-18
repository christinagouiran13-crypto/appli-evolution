-- =====================================================================
-- Réponses types de la coach (insérées en un clic dans une conversation)
-- =====================================================================
create table if not exists public.quick_replies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.quick_replies enable row level security;
create policy "réponses types: coach" on public.quick_replies for all using (public.is_coach()) with check (public.is_coach());

insert into public.quick_replies (title, body, position)
select * from (values
  ('Bien reçu', 'Merci pour ton message {prenom}, bien reçu ! Je te réponds au plus vite 💚', 0),
  ('À voir en séance', 'Merci {prenom} ! C''est un sujet important : on le prend ensemble lors de notre prochaine séance, ce sera plus efficace qu''à l''écrit.', 1),
  ('Réserver une séance', 'Pour en parler tranquillement, réserve ta prochaine séance dans l''appli : Accueil → Mes séances → Réserver ma séance.', 2),
  ('Vocal reçu', 'J''ai bien reçu ton vocal {prenom}. Pour que je te réponde au mieux, écris-moi en quelques lignes ta question principale 🙏', 3),
  ('Bravo débrief', 'Bravo pour ton débrief {prenom} ! Tu as très bien analysé ton parcours. Garde ce qui a marché, on travaille le reste ensemble 💪', 4),
  ('Respiration', 'Pense à ta respiration carrée : inspire 4, bloque 4, souffle 4, bloque 4. Et répète ton mot d''ancrage.', 5),
  ('Check-in', 'Coucou {prenom}, pense à faire ton check-in de la semaine, ça ne prend que 2 minutes 😉', 6)
) as v(title, body, position)
where not exists (select 1 from public.quick_replies);
