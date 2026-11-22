-- Quitter ou supprimer une famille.
-- Ce bloc est aussi dans schema.sql. Ce fichier sert si schema.sql a déjà été lancé :
-- il peut être relancé sans risque.

-- Quitter une famille (tout adulte de la famille).
-- S'il ne reste personne, la famille est supprimée avec ses enfants et ses points.
-- Si le dernier administrateur part, l'adulte arrivé le plus tôt devient administrateur.
create or replace function public.leave_family(fid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  delete from family_members where family_id = fid and user_id = auth.uid();
  if not found then raise exception 'not_member' using errcode = '42501'; end if;
  if not exists (select 1 from family_members where family_id = fid) then
    delete from families where id = fid;
  elsif not exists (select 1 from family_members where family_id = fid and role = 'admin') then
    update family_members set role = 'admin'
     where family_id = fid
       and user_id = (select user_id from family_members where family_id = fid order by created_at, user_id limit 1);
  end if;
end $$;
revoke all on function public.leave_family(uuid) from public, anon;
grant execute on function public.leave_family(uuid) to authenticated;

-- Supprimer une famille (administrateur seulement) : enfants, points, récompenses, pour tout le monde.
create or replace function public.delete_family(fid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin(fid) then raise exception 'not_admin' using errcode = '42501'; end if;
  delete from families where id = fid;
end $$;
revoke all on function public.delete_family(uuid) from public, anon;
grant execute on function public.delete_family(uuid) to authenticated;
