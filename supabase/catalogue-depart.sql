-- Catalogue de départ pour chaque nouvelle famille (Legami 20, livre 70, grand livre 90).
-- Ce bloc est aussi dans schema.sql. Ce fichier sert si schema.sql a déjà été lancé :
-- il peut être relancé sans risque. Les familles déjà créées ne changent pas.

create or replace function public.create_family(fname text) returns uuid
language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  insert into families (name, created_by) values (trim(fname), auth.uid()) returning id into fid;
  -- Catalogue de départ, modifiable ensuite dans l'administration
  insert into rewards (family_id, title, icon, cost) values
    (fid, 'Un Legami',      '🖍️', 20),
    (fid, 'Un livre',       '📘', 70),
    (fid, 'Un grand livre', '📕', 90);
  return fid;
end $$;
revoke all on function public.create_family(text) from public, anon;
grant execute on function public.create_family(text) to authenticated;
