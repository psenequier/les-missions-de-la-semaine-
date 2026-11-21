-- Super admin : un compte qui voit et gère toutes les familles.
-- Ce bloc est aussi dans schema.sql. Ce fichier sert si schema.sql a déjà été lancé :
-- il peut être relancé sans risque.
--
-- Donner le rôle à un compte (dans le SQL Editor de Supabase, jamais depuis le site) :
--   insert into public.super_admins (user_id)
--   select id from auth.users where email = 'adresse@exemple.fr'
--   on conflict do nothing;

create table if not exists public.super_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
-- RLS sans aucune règle : la table est invisible et non modifiable depuis le site.
alter table public.super_admins enable row level security;
revoke all on public.super_admins from anon, authenticated;

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from super_admins where user_id = auth.uid());
$$;
revoke all on function public.is_super_admin() from public, anon;
grant execute on function public.is_super_admin() to authenticated;

create or replace function public.is_member(fid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from family_members where family_id = fid and user_id = auth.uid())
      or public.is_super_admin();
$$;

create or replace function public.is_admin(fid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from family_members where family_id = fid and user_id = auth.uid() and role = 'admin')
      or public.is_super_admin();
$$;

-- Liste de toutes les familles (super admin seulement)
create or replace function public.all_families()
returns table (id uuid, name text, created_at timestamptz, adults bigint, kids bigint, events bigint, last_event timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_super_admin() then raise exception 'not_super_admin' using errcode = '42501'; end if;
  return query
    select f.id, f.name, f.created_at,
      (select count(*) from family_members m where m.family_id = f.id),
      (select count(*) from children c where c.family_id = f.id),
      (select count(*) from events e where e.family_id = f.id),
      (select max(e.created_at) from events e where e.family_id = f.id)
    from families f order by f.name;
end $$;
revoke all on function public.all_families() from public, anon;
grant execute on function public.all_families() to authenticated;
