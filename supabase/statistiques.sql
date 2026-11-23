-- Statistiques du site, pour la page « 📊 Statistiques » du super admin.
-- Ce bloc est aussi dans schema.sql. Ce fichier sert si schema.sql a déjà été lancé :
-- il peut être relancé sans risque. (Il a besoin de super-admin.sql et semaines-terminees.sql.)
--
-- Seulement des totaux : aucun nom, aucune adresse e-mail, rien qui permette de reconnaître une famille.
-- Tout autre compte que le super admin est refusé.

create or replace function public.usage_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  aujourdhui date := (now() at time zone 'Europe/Paris')::date;
begin
  if not public.is_super_admin() then raise exception 'not_super_admin' using errcode = '42501'; end if;
  return jsonb_build_object(
    'comptes',          (select count(*) from auth.users),
    'familles',         (select count(*) from families),
    'familles_enfant',  (select count(*) from families f where exists (select 1 from children c where c.family_id = f.id)),
    'familles_actives', (select count(distinct e.family_id) from events e where e.points > 0 and e.created_at >= public.debut_semaine()),
    -- Nouvelles inscriptions des 30 derniers jours (heure de Paris), du plus récent au plus ancien.
    'jours', (select jsonb_agg(jsonb_build_object(
                'jour', j.jour,
                'comptes',  (select count(*) from auth.users u where (u.created_at at time zone 'Europe/Paris')::date = j.jour),
                'familles', (select count(*) from families f where (f.created_at at time zone 'Europe/Paris')::date = j.jour)
              ) order by j.jour desc)
              from (select aujourdhui - k as jour from generate_series(0, 29) k) j)
  );
end $$;
revoke all on function public.usage_stats() from public, anon;
grant execute on function public.usage_stats() to authenticated;
