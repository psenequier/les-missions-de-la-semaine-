-- Tests de séparation des familles et du super admin.
-- Chaque ligne « OK » est une attaque refusée ; une ligne « FAILLE » arrête le test en erreur.
-- Lancé par la CI après shim.sql, schema.sql et super-admin.sql.
\set ON_ERROR_STOP 1
\set QUIET 1
set client_min_messages = notice;
\o /dev/null

create schema test;
grant usage on schema test to anon, authenticated;
create function test.refuse(requete text, quoi text) returns void language plpgsql as $$
begin
  begin
    execute requete;
  exception when insufficient_privilege or foreign_key_violation or raise_exception or check_violation then
    raise notice 'OK refusé : %', quoi; return;
  end;
  raise exception 'FAILLE : % a été accepté', quoi;
end $$;
create function test.aucune_ligne(requete text, quoi text) returns void language plpgsql as $$
declare n bigint;
begin
  execute requete; get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAILLE : % a touché % ligne(s)', quoi, n; end if;
  raise notice 'OK aucune ligne : %', quoi;
end $$;
create function test.egal(obtenu bigint, attendu bigint, quoi text) returns void language plpgsql as $$
begin
  if obtenu is distinct from attendu then raise exception 'ÉCHEC : % (obtenu %, attendu %)', quoi, obtenu, attendu; end if;
  raise notice 'OK : %', quoi;
end $$;
grant execute on all functions in schema test to anon, authenticated;

insert into auth.users values
  ('11111111-1111-1111-1111-111111111111', 'parent-a@exemple.test'),
  ('22222222-2222-2222-2222-222222222222', 'parent-b@exemple.test'),
  ('33333333-3333-3333-3333-333333333333', 'conjoint-a@exemple.test'),
  ('44444444-4444-4444-4444-444444444444', 'super@exemple.test');

-- Famille A (parent A) et famille B (parent B)
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.create_family('Famille A') as fa \gset
insert into children (family_id, name, character) values (:'fa', 'Enfant A', 'pirate') returning id as ka \gset
insert into events (family_id, child_id, points, label) values (:'fa', :'ka', 5, 'test');
select invite_code as code from families where id = :'fa' \gset

set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select public.create_family('Famille B') as fb \gset
insert into children (family_id, name) values (:'fb', 'Enfant B') returning id as kb \gset

-- Le parent B ne voit ni ne touche rien de la famille A
select test.egal((select count(*) from families where id = :'fa'), 0, 'B ne voit pas la famille A');
select test.egal((select count(*) from children where family_id = :'fa'), 0, 'B ne voit pas les enfants de A');
select test.egal((select count(*) from events where family_id = :'fa'), 0, 'B ne voit pas les points de A');
select test.egal((select count(*) from family_members where family_id = :'fa'), 0, 'B ne voit pas les adultes de A');
select test.refuse(format('insert into events (family_id, child_id, points, label) values (%L, %L, 100, %L)', :'fa', :'ka', 'x'), 'B ajoute des points dans la famille A');
select test.refuse(format('insert into events (family_id, child_id, points, label) values (%L, %L, 100, %L)', :'fb', :'ka', 'x'), 'B ajoute des points à un enfant de A en passant par sa famille');
select test.refuse(format('insert into children (family_id, name) values (%L, %L)', :'fa', 'Intrus'), 'B ajoute un enfant dans A');
select test.refuse(format('insert into family_members (family_id, user_id, role) values (%L, %L, %L)', :'fa', '22222222-2222-2222-2222-222222222222', 'admin'), 'B se met administrateur de A');
select test.refuse(format('select public.new_invite_code(%L)', :'fa'), 'B change le code d''invitation de A');
select test.aucune_ligne(format('update families set name = %L where id = %L', 'piratée', :'fa'), 'B renomme la famille A');
select test.aucune_ligne(format('delete from events where family_id = %L', :'fa'), 'B efface les points de A');
select test.aucune_ligne(format('delete from children where id = %L', :'ka'), 'B efface un enfant de A');
select test.refuse(format('insert into events (family_id, child_id, points, label, created_by) values (%L, %L, 1, %L, %L)', :'fb', :'kb', 'x', '11111111-1111-1111-1111-111111111111'), 'B signe des points au nom d''un autre');

-- Le super admin ne peut pas être obtenu depuis le site
select test.refuse('select public.all_families()', 'un parent liste toutes les familles');
select test.refuse('select count(*) from public.super_admins', 'un parent lit la liste des super admins');
select test.refuse($$insert into public.super_admins values ('22222222-2222-2222-2222-222222222222')$$, 'un parent se déclare super admin');
select test.egal((select public.is_super_admin()::int), 0, 'un parent n''est pas super admin');

-- Visiteur non connecté
reset role; set role anon; set request.jwt.claim.sub = '';
select test.egal((select count(*) from events), 0, 'un visiteur ne voit aucun point');
select test.egal((select count(*) from families), 0, 'un visiteur ne voit aucune famille');
select test.refuse(format('select public.join_family(%L)', :'code'), 'un visiteur rejoint une famille');
select test.refuse('select public.all_families()', 'un visiteur liste toutes les familles');
select test.refuse('select public.create_family(''x'')', 'un visiteur crée une famille');

-- Un adulte invité dans A est simple membre
reset role; set role authenticated; set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select test.egal((select (public.join_family(:'code') = :'fa'::uuid)::int), 1, 'le conjoint rejoint A avec le code');
select test.egal((select count(*) from events), 1, 'le conjoint voit les points de A, et seulement eux');
insert into events (family_id, child_id, points, label) values (:'fa', :'ka', 2, 'ok membre');
select test.refuse(format('insert into children (family_id, name) values (%L, %L)', :'fa', 'Intrus'), 'un simple membre ajoute un enfant');
select test.aucune_ligne(format('update families set settings = %L where id = %L', '{}', :'fa'), 'un simple membre change les missions');
select test.aucune_ligne($$update family_members set role = 'admin' where user_id = '33333333-3333-3333-3333-333333333333'$$, 'un simple membre se promeut administrateur');
select test.refuse(format('select public.new_invite_code(%L)', :'fa'), 'un simple membre change le code d''invitation');

-- Super admin : nommé par le propriétaire de la base, il voit et gère toutes les familles
reset role;
insert into public.super_admins (user_id) values ('44444444-4444-4444-4444-444444444444');
set role authenticated; set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select test.egal((select public.is_super_admin()::int), 1, 'le super admin est reconnu');
select test.egal((select count(*) from public.all_families()), 2, 'le super admin liste les 2 familles');
select test.egal((select count(*) from events where family_id = :'fa'), 2, 'le super admin voit les points de A');
insert into children (family_id, name) values (:'fb', 'Ajout super admin');
select test.egal((select count(*) from children where family_id = :'fb'), 2, 'le super admin gère la famille B');
select test.refuse(format('insert into events (family_id, child_id, points, label) values (%L, %L, 1, %L)', :'fb', :'ka', 'x'), 'même le super admin ne mélange pas les enfants de deux familles');

-- Le parent B ne voit toujours que sa famille
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select test.egal((select count(*) from families), 1, 'B ne voit que sa famille');

reset role;
\o
\echo 'Tous les tests de séparation des familles sont passés.'
