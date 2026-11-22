-- Catalogue de départ pour chaque nouvelle famille, au prix réel avec 1 point ≈ 0,08 € (Legami 1,95 € = 24, livre 7,20 € = 88, grand livre 13 € = 159).
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
    (fid, 'Un Legami',      '🖍️', 24),
    (fid, 'Un livre',       '📘', 88),
    (fid, 'Un grand livre', '📕', 159);
  return fid;
end $$;
revoke all on function public.create_family(text) from public, anon;
grant execute on function public.create_family(text) to authenticated;
