-- Une mission ne rapporte des points qu'une fois par jour et par enfant.
-- Ce bloc est aussi dans schema.sql. Ce fichier sert si schema.sql a déjà été lancé :
-- il peut être relancé sans risque. Les points déjà notés ne changent pas.

-- ───────── Une fois par jour ─────────
-- Une mission (même nom) ne rapporte des points qu'une fois par jour et par enfant,
-- même si deux téléphones appuient en même temps. Les achats (points négatifs) ne sont pas limités.
create or replace function public.une_fois_par_jour() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.points > 0 then
    perform pg_advisory_xact_lock(hashtext(new.child_id::text || '|' || new.label));
    if exists (
      select 1 from events e
      where e.child_id = new.child_id and e.label = new.label and e.points > 0
        and (e.created_at at time zone 'Europe/Paris')::date = (now() at time zone 'Europe/Paris')::date
    ) then
      raise exception 'deja_fait' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists events_une_fois_par_jour on public.events;
create trigger events_une_fois_par_jour before insert on public.events
  for each row execute function public.une_fois_par_jour();
