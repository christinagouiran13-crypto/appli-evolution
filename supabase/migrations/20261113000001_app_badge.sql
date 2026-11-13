-- =====================================================================
-- Pastille sur l'icône de l'appli : nombre de messages non lus
-- =====================================================================
create or replace function public.unread_count(uid uuid) returns int
language plpgsql stable security definer set search_path = public as $$
declare me record; n int;
begin
  if auth.uid() is not null and auth.uid() <> uid then
    raise exception 'Accès refusé';
  end if;
  select * into me from profiles where id = uid;
  if not found then return 0; end if;
  select count(*) into n
  from messages m
  left join read_state r on r.user_id = uid and r.thread = coalesce(m.thread_rider_id::text, 'group')
  where m.sender_id is distinct from uid
    and m.created_at > coalesce(r.last_read_at, me.created_at)
    and (
      (m.thread_rider_id is null and me.status in ('active', 'alumni'))
      or m.thread_rider_id = uid
      or (me.role = 'coach' and m.thread_rider_id is not null)
    );
  return n;
end $$;
grant execute on function public.unread_count(uuid) to authenticated, service_role;
