-- Envoi de photos et vidéos : autorise aussi la mise à jour (certains envois la demandent)
create policy "chat: mise à jour" on storage.objects for update using (
  bucket_id = 'chat' and (
    public.is_coach()
    or ((storage.foldername(name))[1] = 'group' and public.is_member())
    or ((storage.foldername(name))[1] = auth.uid()::text and public.is_active_rider())
  )
);
create policy "ressources: coach met à jour" on storage.objects for update using (bucket_id = 'resources' and public.is_coach());
create policy "audios: coach met à jour" on storage.objects for update using (bucket_id = 'audios' and public.is_coach());
