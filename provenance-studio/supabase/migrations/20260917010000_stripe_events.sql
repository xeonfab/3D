-- Idempotence du webhook Stripe : chaque événement n'est appliqué qu'une fois.
create table public.stripe_events (
  id text primary key,
  type text not null,
  created_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
-- Aucune policy : table réservée au serveur (service_role).
