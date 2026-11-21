-- Droits d'accès aux tables pour les comptes connectés (rôle « authenticated »).
-- Les règles RLS de schema.sql décident ensuite quelles lignes chacun voit : sa famille seulement.
-- Les visiteurs non connectés (rôle « anon ») n'ont aucun droit sur les tables.
-- Ce bloc est aussi dans schema.sql. Ce fichier sert si schema.sql a déjà été lancé :
-- il peut être relancé sans risque.

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
