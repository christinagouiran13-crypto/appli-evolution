-- =====================================================================
-- Passer une cavalière en Junior 90 (ou l'en sortir) depuis sa fiche.
-- Les séances pas encore faites ni réservées prennent les thèmes junior.
-- =====================================================================
create or replace function public.set_junior(rider uuid, junior boolean, parent_ok boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare themes text[];
begin
  if not public.is_coach() then raise exception 'Réservé à la coach'; end if;
  update profiles set
    is_junior = junior,
    program = case when junior then 'starter90'::program_kind else program end,
    parent_consent_at = case when junior and parent_ok then coalesce(parent_consent_at, now()) else parent_consent_at end
  where id = rider and role = 'rider';

  themes := case when junior
    then array['Où j''en suis', 'Mes objectifs', 'Ma concentration', 'Ma confiance en moi', 'Mes émotions', 'Mon plan d''action']
    else array['Objectifs', 'Concentration', 'Confiance en soi', 'Gestion des émotions', 'Plan d''action'] end;

  -- Séances libres (ni faites, ni réservées, ni datées) : nouveaux thèmes
  update sessions s set theme = themes[s.number]
  where s.rider_id = rider and not s.done and s.booked_at is null and s.scheduled_at is null
    and s.number between 1 and array_length(themes, 1);
  delete from sessions s
  where s.rider_id = rider and not s.done and s.booked_at is null and s.scheduled_at is null
    and s.number > array_length(themes, 1);
  -- Séances manquantes
  insert into sessions (rider_id, number, theme)
  select rider, n, themes[n] from generate_series(1, array_length(themes, 1)) n
  where not exists (select 1 from sessions s where s.rider_id = rider and s.number = n);
end $$;
grant execute on function public.set_junior(uuid, boolean, boolean) to authenticated;
