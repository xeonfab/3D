-- Test RLS en SQL pur : isolation entre l'organisation A et l'organisation B.
-- Chaque `assert` lève une exception si la règle n'est pas respectée.
\set ON_ERROR_STOP on
\o /dev/null

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a', 'a@example.com'),
  ('00000000-0000-4000-8000-00000000000b', 'b@example.com');

-- Utilisateur A crée son organisation, un produit et une étape.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

insert into public.organizations (id, name, slug)
  values ('10000000-0000-4000-8000-000000000001', 'Org A', 'org-a');
insert into public.products (id, organization_id, name, slug)
  values ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Produit A', 'produit-a');
insert into public.steps (id, product_id, position, title)
  values ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 0, 'Étape A');

do $$
begin
  assert (select count(*) from public.organization_members
          where organization_id = '10000000-0000-4000-8000-000000000001' and role = 'owner') = 1,
    'le créateur doit être propriétaire';
  assert (select count(*) from public.organizations) = 1, 'A voit son organisation';
end $$;

-- Limites du plan gratuit en base.
do $$
begin
  begin
    insert into public.products (organization_id, name, slug)
      values ('10000000-0000-4000-8000-000000000001', 'Produit 2', 'produit-2');
    raise exception 'le second produit aurait dû être refusé';
  exception when others then
    assert sqlerrm = 'PLAN_LIMIT_PRODUCTS', 'erreur inattendue : ' || sqlerrm;
  end;

  insert into public.steps (product_id, position) values
    ('20000000-0000-4000-8000-000000000001', 1),
    ('20000000-0000-4000-8000-000000000001', 2);
  begin
    insert into public.steps (product_id, position) values ('20000000-0000-4000-8000-000000000001', 3);
    raise exception 'la quatrième étape aurait dû être refusée';
  exception when others then
    assert sqlerrm = 'PLAN_LIMIT_STEPS', 'erreur inattendue : ' || sqlerrm;
  end;
end $$;

-- A ne peut pas changer son plan.
do $$
begin
  begin
    update public.organizations set plan = 'pro' where id = '10000000-0000-4000-8000-000000000001';
    raise exception 'le changement de plan aurait dû être refusé';
  exception when insufficient_privilege then
    null;
  end;
end $$;

-- Utilisateur B.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
insert into public.organizations (id, name, slug)
  values ('10000000-0000-4000-8000-000000000002', 'Org B', 'org-b');

do $$
declare n integer;
begin
  select count(*) into n from public.organizations where id = '10000000-0000-4000-8000-000000000001';
  assert n = 0, 'B ne doit pas voir l''organisation A';
  select count(*) into n from public.organization_members where organization_id = '10000000-0000-4000-8000-000000000001';
  assert n = 0, 'B ne doit pas voir les membres de A';
  select count(*) into n from public.products where organization_id = '10000000-0000-4000-8000-000000000001';
  assert n = 0, 'B ne doit pas voir les produits de A';
  select count(*) into n from public.steps where product_id = '20000000-0000-4000-8000-000000000001';
  assert n = 0, 'B ne doit pas voir les étapes de A';

  update public.products set name = 'Piraté' where id = '20000000-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'B ne doit pas modifier les produits de A';

  update public.steps set title = 'Piraté' where id = '30000000-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'B ne doit pas modifier les étapes de A';

  delete from public.products where id = '20000000-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'B ne doit pas supprimer les produits de A';

  begin
    insert into public.products (organization_id, name, slug)
      values ('10000000-0000-4000-8000-000000000001', 'Intrus', 'intrus');
    raise exception 'B ne doit pas créer de produit chez A';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.steps (product_id, position)
      values ('20000000-0000-4000-8000-000000000001', 5);
    raise exception 'B ne doit pas créer d''étape chez A';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.organization_members (organization_id, user_id, role)
      values ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000b', 'owner');
    raise exception 'B ne doit pas s''inviter chez A';
  exception when insufficient_privilege then null;
  end;

  -- Storage : B ne peut pas écrire dans le dossier de A, A le peut.
  begin
    insert into storage.objects (bucket_id, name)
      values ('logos', '10000000-0000-4000-8000-000000000001/logo.png');
    raise exception 'B ne doit pas téléverser dans le dossier de A';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
insert into storage.objects (bucket_id, name) values ('logos', '10000000-0000-4000-8000-000000000001/logo.png');

do $$
declare n integer;
begin
  -- Le service_role (serveur) voit tout : vérifié via bypassrls.
  select count(*) into n from public.products where id = '20000000-0000-4000-8000-000000000001';
  assert n = 1, 'A voit toujours son produit intact';
  assert (select name from public.products where id = '20000000-0000-4000-8000-000000000001') = 'Produit A';
end $$;

-- Les compteurs de page publique ne sont pas appelables par un utilisateur.
do $$
begin
  begin
    perform public.increment_public_page_counters('org-a-produit-a', false);
    raise exception 'un utilisateur ne doit pas pouvoir incrémenter les compteurs';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
do $$
declare n integer;
begin
  select count(*) into n from public.organizations;
  assert n = 2, 'le superutilisateur voit les deux organisations';
end $$;

rollback;
\o
\echo 'RLS : tous les scénarios passent.'
