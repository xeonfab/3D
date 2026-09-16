-- =============================================================================
-- Provenance Studio — schéma initial
-- Toutes les tables : id uuid, created_at, updated_at. RLS activée partout.
-- Un utilisateur ne voit que les lignes de son organisation.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------
create type public.plan_type as enum ('free', 'pro');
create type public.member_role as enum ('owner', 'member');
create type public.product_status as enum ('draft', 'ready');
create type public.transport_mode as enum ('land', 'sea', 'air');
create type public.render_format as enum ('vertical', 'horizontal');
create type public.render_status as enum ('queued', 'rendering', 'done', 'failed');

-- -----------------------------------------------------------------------------
-- Utilitaires
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 60),
  logo_path text,
  brand_color text not null default '#D9822B' check (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  plan public.plan_type not null default 'free',
  stripe_customer_id text unique,
  stripe_subscription_id text unique
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'member',
  unique (organization_id, user_id)
);
create index organization_members_user_id_idx on public.organization_members (user_id);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 1 and 80),
  end_line text not null default '' check (char_length(end_line) <= 140),
  status public.product_status not null default 'draft',
  public boolean not null default false,
  unique (organization_id, slug)
);
create index products_organization_id_idx on public.products (organization_id);

create table public.steps (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  product_id uuid not null references public.products (id) on delete cascade,
  position integer not null check (position >= 0),
  title text not null default '' check (char_length(title) <= 60),
  caption text not null default '' check (char_length(caption) <= 90),
  place_name text not null default '' check (char_length(place_name) <= 120),
  -- Jamais de coordonnées inventées : null tant que l'utilisateur n'a pas
  -- choisi un lieu via le geocoder (ou saisi explicitement).
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  mode public.transport_mode not null default 'land',
  photo_path text,
  -- Tableau de [lng, lat] : calculé pour `sea`, éditable par l'utilisateur.
  waypoints jsonb not null default '[]'::jsonb check (jsonb_typeof(waypoints) = 'array'),
  duration_seconds integer not null default 6 check (duration_seconds between 2 and 20),
  check ((lat is null) = (lng is null))
);
create index steps_product_id_position_idx on public.steps (product_id, position);

create table public.renders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  product_id uuid not null references public.products (id) on delete cascade,
  format public.render_format not null,
  status public.render_status not null default 'queued',
  progress integer not null default 0 check (progress between 0 and 100),
  video_path text,
  thumbnail_path text,
  error text,
  render_id_provider text,
  watermark boolean not null default true,
  duration_seconds integer
);
create index renders_product_id_idx on public.renders (product_id, created_at desc);

create table public.public_pages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  product_id uuid not null unique references public.products (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 100),
  views_count integer not null default 0,
  qr_scans_count integer not null default 0
);

-- updated_at automatique
create trigger organizations_set_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();
create trigger organization_members_set_updated_at before update on public.organization_members
  for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create trigger steps_set_updated_at before update on public.steps
  for each row execute function public.set_updated_at();
create trigger renders_set_updated_at before update on public.renders
  for each row execute function public.set_updated_at();
create trigger public_pages_set_updated_at before update on public.public_pages
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Fonctions d'appartenance (security definer : évitent la récursion RLS
-- sur organization_members).
-- -----------------------------------------------------------------------------
create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_org_owner(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org_id and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

create or replace function public.is_product_member(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.products p
    join public.organization_members m on m.organization_id = p.organization_id
    where p.id = p_id and m.user_id = auth.uid()
  );
$$;

-- Le premier segment du chemin d'un objet Storage est l'id d'organisation.
create or replace function public.is_org_member_path(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org uuid;
begin
  begin
    org := (storage.foldername(object_name))[1]::uuid;
  exception when others then
    return false;
  end;
  return public.is_org_member(org);
end;
$$;

revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.is_org_owner(uuid) from public;
revoke all on function public.is_product_member(uuid) from public;
revoke all on function public.is_org_member_path(text) from public;
grant execute on function public.is_org_member(uuid) to authenticated, service_role;
grant execute on function public.is_org_owner(uuid) to authenticated, service_role;
grant execute on function public.is_product_member(uuid) to authenticated, service_role;
grant execute on function public.is_org_member_path(text) to authenticated, service_role;

-- Le créateur d'une organisation en devient automatiquement propriétaire.
create or replace function public.add_creator_as_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    insert into public.organization_members (organization_id, user_id, role)
    values (new.id, auth.uid(), 'owner')
    on conflict (organization_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger organizations_add_creator_as_owner after insert on public.organizations
  for each row execute function public.add_creator_as_owner();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.products enable row level security;
alter table public.steps enable row level security;
alter table public.renders enable row level security;
alter table public.public_pages enable row level security;

-- organizations ---------------------------------------------------------------
create policy "organizations: membres lisent"
  on public.organizations for select to authenticated
  using (public.is_org_member(id));

create policy "organizations: utilisateur connecté crée"
  on public.organizations for insert to authenticated
  with check (auth.uid() is not null);

create policy "organizations: propriétaires modifient"
  on public.organizations for update to authenticated
  using (public.is_org_owner(id))
  with check (public.is_org_owner(id));

create policy "organizations: propriétaires suppriment"
  on public.organizations for delete to authenticated
  using (public.is_org_owner(id));

-- Le plan et les identifiants Stripe ne sont modifiables que par le serveur
-- (service_role, via le webhook Stripe), jamais par un utilisateur.
revoke update on public.organizations from authenticated;
grant update (name, slug, logo_path, brand_color) on public.organizations to authenticated;

-- organization_members ---------------------------------------------------------
create policy "members: membres lisent"
  on public.organization_members for select to authenticated
  using (public.is_org_member(organization_id));

create policy "members: propriétaires invitent"
  on public.organization_members for insert to authenticated
  with check (public.is_org_owner(organization_id));

create policy "members: propriétaires modifient les rôles"
  on public.organization_members for update to authenticated
  using (public.is_org_owner(organization_id))
  with check (public.is_org_owner(organization_id));

create policy "members: propriétaires retirent, chacun peut partir"
  on public.organization_members for delete to authenticated
  using (public.is_org_owner(organization_id) or user_id = auth.uid());

-- products ---------------------------------------------------------------------
create policy "products: membres lisent"
  on public.products for select to authenticated
  using (public.is_org_member(organization_id));

create policy "products: membres créent"
  on public.products for insert to authenticated
  with check (public.is_org_member(organization_id));

create policy "products: membres modifient"
  on public.products for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "products: membres suppriment"
  on public.products for delete to authenticated
  using (public.is_org_member(organization_id));

-- steps ------------------------------------------------------------------------
create policy "steps: membres lisent"
  on public.steps for select to authenticated
  using (public.is_product_member(product_id));

create policy "steps: membres créent"
  on public.steps for insert to authenticated
  with check (public.is_product_member(product_id));

create policy "steps: membres modifient"
  on public.steps for update to authenticated
  using (public.is_product_member(product_id))
  with check (public.is_product_member(product_id));

create policy "steps: membres suppriment"
  on public.steps for delete to authenticated
  using (public.is_product_member(product_id));

-- renders ----------------------------------------------------------------------
-- Les rendus sont créés et mis à jour uniquement par le serveur (service_role),
-- qui applique les limites de plan. Les membres les lisent et peuvent les
-- supprimer.
create policy "renders: membres lisent"
  on public.renders for select to authenticated
  using (public.is_product_member(product_id));

create policy "renders: membres suppriment"
  on public.renders for delete to authenticated
  using (public.is_product_member(product_id));

-- public_pages -----------------------------------------------------------------
-- Lecture publique (page /v/[slug]) et compteurs : côté serveur (service_role).
create policy "public_pages: membres lisent"
  on public.public_pages for select to authenticated
  using (public.is_product_member(product_id));

create policy "public_pages: membres créent"
  on public.public_pages for insert to authenticated
  with check (public.is_product_member(product_id));

create policy "public_pages: membres modifient le slug"
  on public.public_pages for update to authenticated
  using (public.is_product_member(product_id))
  with check (public.is_product_member(product_id));

revoke update on public.public_pages from authenticated;
grant update (slug) on public.public_pages to authenticated;

create policy "public_pages: membres suppriment"
  on public.public_pages for delete to authenticated
  using (public.is_product_member(product_id));

-- -----------------------------------------------------------------------------
-- Storage : trois buckets publics en lecture (les fichiers sont référencés par
-- des URL dans les vidéos et la page publique), écriture réservée aux membres
-- de l'organisation dont l'id est le premier segment du chemin :
--   logos/<organization_id>/logo.png
--   photos/<organization_id>/<product_id>/<step_id>.jpg
--   renders/<organization_id>/<product_id>/<render_id>.mp4
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('logos', 'logos', true, 2097152, array['image/png', 'image/svg+xml']),
  ('photos', 'photos', true, 1048576, array['image/jpeg', 'image/png', 'image/webp']),
  ('renders', 'renders', true, 524288000, array['video/mp4', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "storage: lecture publique des buckets du produit"
  on storage.objects for select to public
  using (bucket_id in ('logos', 'photos', 'renders'));

create policy "storage: membres téléversent"
  on storage.objects for insert to authenticated
  with check (bucket_id in ('logos', 'photos') and public.is_org_member_path(name));

create policy "storage: membres remplacent"
  on storage.objects for update to authenticated
  using (bucket_id in ('logos', 'photos') and public.is_org_member_path(name))
  with check (bucket_id in ('logos', 'photos') and public.is_org_member_path(name));

create policy "storage: membres suppriment"
  on storage.objects for delete to authenticated
  using (bucket_id in ('logos', 'photos', 'renders') and public.is_org_member_path(name));

-- -----------------------------------------------------------------------------
-- Limites de plan, appliquées en base (en plus des Server Actions) pour
-- qu'aucun appel direct à l'API ne puisse les contourner.
--   free : 1 produit, 3 étapes par produit
--   pro  : produits illimités, 12 étapes par produit
-- -----------------------------------------------------------------------------
create or replace function public.plan_max_products(p public.plan_type)
returns integer
language sql
immutable
as $$
  select case p when 'free' then 1 else null end;
$$;

create or replace function public.plan_max_steps(p public.plan_type)
returns integer
language sql
immutable
as $$
  select case p when 'free' then 3 else 12 end;
$$;

create or replace function public.enforce_product_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org_plan public.plan_type;
  max_products integer;
  current_count integer;
begin
  -- Un non-membre est refusé par la RLS : on ne révèle rien sur l'organisation.
  if auth.uid() is not null and not public.is_org_member(new.organization_id) then
    return new;
  end if;
  select plan into org_plan from public.organizations where id = new.organization_id;
  max_products := public.plan_max_products(org_plan);
  if max_products is not null then
    select count(*) into current_count from public.products where organization_id = new.organization_id;
    if current_count >= max_products then
      raise exception 'PLAN_LIMIT_PRODUCTS' using errcode = 'P0001',
        hint = 'Le plan gratuit permet un seul produit.';
    end if;
  end if;
  return new;
end;
$$;

create trigger products_enforce_plan_limit before insert on public.products
  for each row execute function public.enforce_product_limit();

create or replace function public.enforce_step_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org_plan public.plan_type;
  max_steps integer;
  current_count integer;
begin
  if auth.uid() is not null and not public.is_product_member(new.product_id) then
    return new;
  end if;
  select o.plan into org_plan
  from public.products p join public.organizations o on o.id = p.organization_id
  where p.id = new.product_id;
  max_steps := public.plan_max_steps(org_plan);
  select count(*) into current_count from public.steps where product_id = new.product_id;
  if current_count >= max_steps then
    raise exception 'PLAN_LIMIT_STEPS' using errcode = 'P0001',
      hint = format('Ce plan permet %s étapes par produit.', max_steps);
  end if;
  return new;
end;
$$;

create trigger steps_enforce_plan_limit before insert on public.steps
  for each row execute function public.enforce_step_limit();
