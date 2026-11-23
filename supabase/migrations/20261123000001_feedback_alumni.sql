-- Les anciennes clientes peuvent aussi remplir le questionnaire de feedback
drop policy if exists "feedback: ajout" on public.competition_feedback;
create policy "feedback: ajout" on public.competition_feedback for insert
  with check ((rider_id = auth.uid() and public.is_member()) or public.is_coach());
