-- =====================================================================
-- Réactions emoji sur les messages (une réaction par personne et par message)
-- =====================================================================
create table if not exists public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  emoji text not null check (char_length(emoji) <= 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
create index if not exists message_reactions_msg on public.message_reactions (message_id);

alter table public.message_reactions enable row level security;
-- Visible si le message est visible (les règles de la messagerie s'appliquent)
create policy "réactions: lecture" on public.message_reactions for select
  using (exists (select 1 from public.messages m where m.id = message_id));
create policy "réactions: ajouter la sienne" on public.message_reactions for insert
  with check (user_id = auth.uid() and public.is_member() and exists (select 1 from public.messages m where m.id = message_id));
create policy "réactions: changer la sienne" on public.message_reactions for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "réactions: retirer la sienne" on public.message_reactions for delete
  using (user_id = auth.uid());

alter table public.message_reactions replica identity full;
alter publication supabase_realtime add table public.message_reactions;
