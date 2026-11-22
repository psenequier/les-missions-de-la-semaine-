-- Catalogue de départ de chaque nouvelle famille : une copie des récompenses de la famille
-- du super admin (la plus ancienne famille dont un super admin est administrateur).
-- Si cette famille n'existe pas ou n'a aucune récompense : Legami 24, livre 88, grand livre 159.
-- Ce bloc est aussi dans schema.sql. Ce fichier sert si schema.sql a déjà été lancé :
-- il peut être relancé sans risque. Les familles déjà créées ne changent pas.

-- Prix en euros des récompenses (voir prix-en-euros.sql)
alter table public.rewards add column if not exists price_eur numeric(7,2) check (price_eur is null or (price_eur > 0 and price_eur <= 1000));

create or replace function public.create_family(fname text) returns uuid
language plpgsql security definer set search_path = public as $$
declare fid uuid; modele uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  insert into families (name, created_by) values (trim(fname), auth.uid()) returning id into fid;
  -- Catalogue de départ, modifiable ensuite dans l'administration.
  -- Modèle : la plus ancienne famille dont un super admin est administrateur.
  -- Ses récompenses sont copiées (nom, image, prix), pour tous les enfants.
  select f.id into modele
    from families f
    join family_members m on m.family_id = f.id and m.role = 'admin'
    join super_admins s on s.user_id = m.user_id
   where f.id <> fid
   order by f.created_at
   limit 1;
  if modele is not null and exists (select 1 from rewards where family_id = modele) then
    insert into rewards (family_id, title, icon, cost, price_eur)
      select fid, title, icon, cost, price_eur from rewards where family_id = modele order by cost, created_at;
  else
    -- Sans modèle : catalogue fixe, au prix réel (1 point ≈ 0,08 € avec le budget par défaut)
    insert into rewards (family_id, title, icon, cost, price_eur) values
      (fid, 'Un Legami',      '🖍️', 24,  1.95),
      (fid, 'Un livre',       '📘', 88,  7.20),
      (fid, 'Un grand livre', '📕', 159, 13.00);
  end if;
  return fid;
end $$;
revoke all on function public.create_family(text) from public, anon;
grant execute on function public.create_family(text) to authenticated;
