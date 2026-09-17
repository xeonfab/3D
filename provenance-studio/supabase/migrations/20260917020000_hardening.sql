-- Durcissement signalé par les conseillers de sécurité Supabase.

-- Les fonctions trigger n'ont aucune raison d'être exposées par RPC.
revoke all on function public.add_creator_as_owner() from public, anon, authenticated;
revoke all on function public.enforce_product_limit() from public, anon, authenticated;
revoke all on function public.enforce_step_limit() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;

-- Les fonctions d'appartenance sont appelées par les policies RLS des
-- utilisateurs connectés : `authenticated` doit pouvoir les exécuter, pas `anon`.
revoke all on function public.is_org_member(uuid) from anon;
revoke all on function public.is_org_owner(uuid) from anon;
revoke all on function public.is_product_member(uuid) from anon;
revoke all on function public.is_org_member_path(text) from anon;

-- search_path figé sur les fonctions qui ne l'avaient pas.
alter function public.set_updated_at() set search_path = public;
alter function public.plan_max_products(public.plan_type) set search_path = public;
alter function public.plan_max_steps(public.plan_type) set search_path = public;
revoke all on function public.plan_max_products(public.plan_type) from public, anon;
revoke all on function public.plan_max_steps(public.plan_type) from public, anon;
