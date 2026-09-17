-- Compteurs de la page publique : incrément atomique, réservé au serveur.
create or replace function public.increment_public_page_counters(page_slug text, from_qr boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.public_pages
  set views_count = views_count + 1,
      qr_scans_count = qr_scans_count + (case when from_qr then 1 else 0 end)
  where slug = page_slug;
$$;

revoke all on function public.increment_public_page_counters(text, boolean) from public;
revoke all on function public.increment_public_page_counters(text, boolean) from anon, authenticated;
grant execute on function public.increment_public_page_counters(text, boolean) to service_role;
