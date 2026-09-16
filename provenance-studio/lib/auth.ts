import "server-only";

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { OrganizationRow, MemberRole } from "@/lib/supabase/types";

export type Membership = {
  organization: OrganizationRow;
  role: MemberRole;
};

/** Utilisateur connecté ou null. Vérifié auprès de Supabase (pas seulement le cookie). */
export async function getUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Utilisateur connecté, sinon redirection vers /login. */
export async function requireUser(next?: string): Promise<User> {
  const user = await getUser();
  if (!user) {
    redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }
  return user;
}

/**
 * Organisation courante de l'utilisateur (la première dont il est membre).
 * Le produit est mono-organisation par utilisateur pour l'instant.
 */
export async function getMembership(): Promise<Membership | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select("role, organization:organizations(*)")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data || !data.organization) return null;
  return { organization: data.organization as OrganizationRow, role: data.role };
}

/** Utilisateur connecté ET membre d'une organisation, sinon redirection. */
export async function requireMembership(): Promise<{ user: User; membership: Membership }> {
  const user = await requireUser();
  const membership = await getMembership();
  if (!membership) redirect("/onboarding");
  return { user, membership };
}
