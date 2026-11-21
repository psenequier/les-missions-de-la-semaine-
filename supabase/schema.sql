-- Points en famille : base de données Supabase
-- À coller une seule fois dans Supabase > SQL Editor > New query, puis "Run".
-- Chaque famille ne voit et ne modifie que ses propres données (Row Level Security).

create extension if not exists pgcrypto;

-- ───────────── Tables ─────────────

create table public.families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 60),
  invite_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  settings    jsonb not null default '{
    "routines": {
      "matin": {"label": "Missions du matin", "icon": "🌅", "points": 2,
                "items": ["M''habiller", "Faire mes tartines", "Débarrasser", "Me brosser les dents", "Prendre mon cartable"]},
      "soir":  {"label": "Missions du soir", "icon": "🌙", "points": 3,
                "items": ["Prendre ma douche", "Mettre mon pyjama", "Me brosser les dents", "Ranger mes affaires", "Préparer mes habits pour demain"]}
    },
    "tasks": [
      {"label": "Chambre rangée", "icon": "🧸", "points": 2},
      {"label": "Devoirs tout seul", "icon": "✏️", "points": 3}
    ]
  }'::jsonb,
  created_by  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table public.family_members (
  family_id  uuid not null references public.families(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (family_id, user_id)
);
create index on public.family_members (user_id);

create table public.children (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 30),
  character   text not null default 'pirate',
  weekly_goal int  not null default 25 check (weekly_goal between 1 and 999),
  position    int  not null default 0,
  created_at  timestamptz not null default now(),
  unique (id, family_id)
);

create table public.rewards (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families(id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 40),
  icon       text not null default '🎁',
  cost       int  not null check (cost between 1 and 9999),
  child_ids  uuid[],            -- null = pour tous les enfants
  created_at timestamptz not null default now()
);

create table public.events (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null,
  child_id   uuid not null,
  points     int  not null check (points between -9999 and 999 and points <> 0),
  label      text not null check (char_length(label) between 1 and 60),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  -- l'enfant doit appartenir à la même famille
  foreign key (child_id, family_id) references public.children(id, family_id) on delete cascade
);
create index on public.events (family_id, created_at);

create table public.checks (
  family_id  uuid not null,
  child_id   uuid not null,
  day        date not null,
  item       text not null check (char_length(item) between 1 and 80),
  created_at timestamptz not null default now(),
  primary key (child_id, day, item),
  foreign key (child_id, family_id) references public.children(id, family_id) on delete cascade
);
create index on public.checks (family_id, day);

-- ───────────── Fonctions d'appartenance ─────────────

-- Super admin (voir aussi super-admin.sql pour l'ajouter à une base existante)
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

-- Le créateur d'une famille en devient l'administrateur
create or replace function public.add_creator_as_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into family_members (family_id, user_id, role) values (new.id, new.created_by, 'admin');
  return new;
end $$;
create trigger families_add_admin after insert on public.families
  for each row execute function public.add_creator_as_admin();

-- Créer une famille (le site appelle cette fonction)
create or replace function public.create_family(fname text) returns uuid
language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  insert into families (name, created_by) values (trim(fname), auth.uid()) returning id into fid;
  return fid;
end $$;
revoke all on function public.create_family(text) from public, anon;
grant execute on function public.create_family(text) to authenticated;

-- Rejoindre une famille avec son code d'invitation (comme simple membre)
create or replace function public.join_family(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select id into fid from families where invite_code = upper(trim(code));
  if fid is null then raise exception 'bad_code'; end if;
  insert into family_members (family_id, user_id, role) values (fid, auth.uid(), 'member')
    on conflict do nothing;
  return fid;
end $$;
revoke all on function public.join_family(text) from public, anon;
grant execute on function public.join_family(text) to authenticated;

-- Nouveau code d'invitation (admin seulement)
create or replace function public.new_invite_code(fid uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not is_admin(fid) then raise exception 'not_admin'; end if;
  c := upper(substr(md5(gen_random_uuid()::text), 1, 8));
  update families set invite_code = c where id = fid;
  return c;
end $$;
revoke all on function public.new_invite_code(uuid) from public, anon;
grant execute on function public.new_invite_code(uuid) to authenticated;

-- ───────────── Row Level Security ─────────────

alter table public.families       enable row level security;
alter table public.family_members enable row level security;
alter table public.children       enable row level security;
alter table public.rewards        enable row level security;
alter table public.events         enable row level security;
alter table public.checks         enable row level security;

-- Familles
create policy fam_select on public.families for select to authenticated using (is_member(id));
create policy fam_insert on public.families for insert to authenticated with check (created_by = auth.uid());
create policy fam_update on public.families for update to authenticated using (is_admin(id)) with check (is_admin(id));
create policy fam_delete on public.families for delete to authenticated using (is_admin(id));

-- Membres : on voit les membres de sa famille ; l'admin peut retirer quelqu'un ; chacun peut partir
create policy mem_select on public.family_members for select to authenticated using (is_member(family_id));
create policy mem_delete on public.family_members for delete to authenticated using (is_admin(family_id) or user_id = auth.uid());
create policy mem_update on public.family_members for update to authenticated using (is_admin(family_id)) with check (is_admin(family_id));

-- Enfants et récompenses : lecture par la famille, modification par l'admin
create policy kid_select on public.children for select to authenticated using (is_member(family_id));
create policy kid_write  on public.children for all    to authenticated using (is_admin(family_id)) with check (is_admin(family_id));
create policy rew_select on public.rewards  for select to authenticated using (is_member(family_id));
create policy rew_write  on public.rewards  for all    to authenticated using (is_admin(family_id)) with check (is_admin(family_id));

-- Points et cases cochées : toute la famille peut ajouter et annuler
create policy ev_select on public.events for select to authenticated using (is_member(family_id));
create policy ev_insert on public.events for insert to authenticated with check (is_member(family_id) and created_by = auth.uid());
create policy ev_delete on public.events for delete to authenticated using (is_member(family_id));
create policy ck_select on public.checks for select to authenticated using (is_member(family_id));
create policy ck_insert on public.checks for insert to authenticated with check (is_member(family_id));
create policy ck_delete on public.checks for delete to authenticated using (is_member(family_id));

-- ───────────── Mises à jour en direct ─────────────
-- ───────── Droits d'accès (voir aussi droits.sql pour une base déjà créée) ─────────
grant usage on schema public to anon, authenticated;
revoke all on public.families, public.family_members, public.children,
              public.rewards, public.events, public.checks from anon;
grant select, insert, update, delete on public.families       to authenticated;
grant select, update, delete         on public.family_members to authenticated;
grant select, insert, update, delete on public.children       to authenticated;
grant select, insert, update, delete on public.rewards        to authenticated;
grant select, insert, delete         on public.events         to authenticated;
grant select, insert, delete         on public.checks         to authenticated;
grant execute on function public.is_member(uuid), public.is_admin(uuid) to authenticated;

alter publication supabase_realtime add table public.events, public.checks, public.children, public.rewards, public.families;
