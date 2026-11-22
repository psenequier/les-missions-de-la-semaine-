-- Semaines terminées : leurs points et leurs résultats ne changent plus.
-- Ce bloc est aussi dans schema.sql. Ce fichier sert si schema.sql a déjà été lancé :
-- il peut être relancé sans risque. Les points déjà notés ne changent pas.

-- ───────── Semaines terminées ─────────
-- Une semaine va du lundi au dimanche (heure de Paris). Une fois finie, ses points sont gardés :
-- on ne peut plus les annuler, ni ajouter des points avec une date passée.
-- Seule la suppression d'un enfant (ou d'une famille) efface encore tout son historique.
create or replace function public.debut_semaine() returns timestamptz
language sql stable set search_path = public as $$
  select date_trunc('week', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris';
$$;

create or replace function public.semaine_terminee() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();  -- la date des points est toujours celle du serveur
    return new;
  end if;
  -- pg_trigger_depth() > 1 : suppression qui suit celle d'un enfant ou d'une famille
  if old.created_at < debut_semaine() and pg_trigger_depth() = 1 then
    raise exception 'semaine_terminee' using errcode = 'P0001';
  end if;
  return old;
end $$;
drop trigger if exists events_semaine_terminee on public.events;
create trigger events_semaine_terminee before insert or delete on public.events
  for each row execute function public.semaine_terminee();

-- « Remettre la semaine à zéro » (administration) : n'efface que la semaine en cours
create or replace function public.remettre_semaine_a_zero(fid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin(fid) then raise exception 'not_admin' using errcode = '42501'; end if;
  delete from events where family_id = fid and created_at >= debut_semaine();
  delete from checks where family_id = fid and day >= (debut_semaine() at time zone 'Europe/Paris')::date;
end $$;
revoke all on function public.remettre_semaine_a_zero(uuid) from public, anon;
grant execute on function public.remettre_semaine_a_zero(uuid) to authenticated;

-- Objectif de chaque semaine : changer l'objectif d'un enfant ne change pas
-- le résultat (« objectif ✓ » ou « pas atteint ») des semaines terminées.
create table if not exists public.weekly_goals (
  family_id uuid not null,
  child_id  uuid not null,
  week      date not null,  -- lundi de la première semaine avec cet objectif
  goal      int  not null check (goal between 1 and 999),
  primary key (child_id, week),
  foreign key (child_id, family_id) references public.children(id, family_id) on delete cascade
);
alter table public.weekly_goals enable row level security;
drop policy if exists wg_select on public.weekly_goals;
create policy wg_select on public.weekly_goals for select to authenticated using (is_member(family_id));
revoke all on public.weekly_goals from anon, authenticated;
grant select on public.weekly_goals to authenticated;

create or replace function public.noter_objectif() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into weekly_goals (family_id, child_id, week, goal)
    values (new.family_id, new.id, (debut_semaine() at time zone 'Europe/Paris')::date, new.weekly_goal)
    on conflict (child_id, week) do update set goal = excluded.goal;
  return new;
end $$;
drop trigger if exists children_noter_objectif on public.children;
create trigger children_noter_objectif after insert or update of weekly_goal on public.children
  for each row execute function public.noter_objectif();

-- Les objectifs déjà en place valent pour toutes les semaines passées
insert into public.weekly_goals (family_id, child_id, week, goal)
  select family_id, id, date '2000-01-03', weekly_goal from public.children
  on conflict do nothing;
