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
select test.refuse(format('insert into events (family_id, child_id, points, label) values (%L, %L, 5, %L)', :'fa', :'ka', 'test'), 'la même mission deux fois le même jour');
insert into events (family_id, child_id, points, label) values (:'fa', :'ka', -3, 'Un achat'), (:'fa', :'ka', -3, 'Un achat');
select test.egal((select count(*) from events where child_id = :'ka' and label = 'Un achat'), 2, 'les achats ne sont pas limités à un par jour');
delete from events where child_id = :'ka' and label = 'Un achat';
select test.egal((select count(*) from rewards where family_id = :'fa'), 3, 'une nouvelle famille reçoit le catalogue de départ');

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
select test.refuse('select count(*) from events', 'un visiteur lit les points');
select test.refuse('select count(*) from families', 'un visiteur lit les familles');
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

-- Un parent connecté peut lire sa famille avec l'API (droits accordés par schema.sql)
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select test.egal((select count(*) from family_members m join families f on f.id = m.family_id where m.user_id = auth.uid()), 1, 'le parent A lit sa famille et son rôle');

-- Le parent B ne voit toujours que sa famille
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select test.egal((select count(*) from families), 1, 'B ne voit que sa famille');

-- Semaines terminées : leurs points ne changent plus
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into children (family_id, name) values (:'fa', 'Enfant semaines') returning id as ks \gset
insert into events (family_id, child_id, points, label) values (:'fa', :'ks', 4, 'semaine passée') returning id as ev_vieux \gset
reset role;
update events set created_at = public.debut_semaine() - interval '1 day' where id = :'ev_vieux';
update weekly_goals set week = date '2000-01-03' where child_id = :'ks';
set role authenticated; set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select test.refuse(format('delete from events where id = %L', :'ev_vieux'), 'annuler des points d''une semaine terminée');
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select test.refuse(format('delete from events where id = %L', :'ev_vieux'), 'même le super admin annule des points d''une semaine terminée');
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into events (family_id, child_id, points, label, created_at) values (:'fa', :'ks', 3, 'antidaté', now() - interval '10 days');
select test.egal((select count(*) from events where label = 'antidaté' and created_at < public.debut_semaine()), 0, 'des points ajoutés avec une date passée comptent pour la semaine en cours');
insert into events (family_id, child_id, points, label) values (:'fa', :'ks', 2, 'cette semaine') returning id as ev_neuf \gset
delete from events where id = :'ev_neuf';
select test.egal((select count(*) from events where id = :'ev_neuf'), 0, 'on peut encore annuler des points de la semaine en cours');
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select test.refuse(format('select public.remettre_semaine_a_zero(%L)', :'fa'), 'B remet la semaine de A à zéro');
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select test.refuse(format('select public.remettre_semaine_a_zero(%L)', :'fa'), 'un simple membre remet la semaine à zéro');
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.remettre_semaine_a_zero(:'fa');
select test.egal((select count(*) from events where family_id = :'fa' and created_at >= public.debut_semaine()), 0, 'la remise à zéro efface la semaine en cours');
select test.egal((select count(*) from events where id = :'ev_vieux'), 1, 'la remise à zéro garde les semaines terminées');

-- L'objectif des semaines terminées est gardé quand on le change
update children set weekly_goal = 40 where id = :'ks';
select test.egal((select goal from weekly_goals where child_id = :'ks' and week = date '2000-01-03'), 25, 'l''ancien objectif reste pour les semaines terminées');
select test.egal((select goal from weekly_goals where child_id = :'ks' and week = (public.debut_semaine() at time zone 'Europe/Paris')::date), 40, 'le nouvel objectif compte à partir de cette semaine');
select test.refuse(format('insert into weekly_goals (family_id, child_id, week, goal) values (%L, %L, %L, 1)', :'fa', :'ks', '2000-01-03'), 'un parent réécrit l''objectif d''une semaine terminée');
select test.refuse(format('update weekly_goals set goal = 1 where child_id = %L', :'ks'), 'un parent change l''objectif d''une semaine terminée');
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select test.egal((select count(*) from weekly_goals where family_id = :'fa'), 0, 'B ne voit pas les objectifs de A');

-- Supprimer un enfant efface encore tout son historique
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
delete from children where id = :'ks';
select test.egal((select count(*) from events where id = :'ev_vieux'), 0, 'supprimer un enfant efface aussi ses semaines terminées');

reset role;
\o
\echo 'Tous les tests de séparation des familles sont passés.'
