import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { MemberRole } from "@/lib/supabase/types";

export type MemberView = {
  id: string;
  userId: string;
  email: string;
  role: MemberRole;
  createdAt: string;
};

/** Membres d'une organisation avec leur email (lecture admin de auth.users). */
export async function listMembers(organizationId: string): Promise<MemberView[]> {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("organization_members")
    .select("id, user_id, role, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });
  const members: MemberView[] = [];
  for (const row of rows ?? []) {
    const { data } = await admin.auth.admin.getUserById(row.user_id);
    members.push({
      id: row.id,
      userId: row.user_id,
      email: data.user?.email ?? "(email inconnu)",
      role: row.role,
      createdAt: row.created_at,
    });
  }
  return members;
}

export async function listOrganizationOwnersEmails(organizationId: string): Promise<string[]> {
  const members = await listMembers(organizationId);
  return members
    .filter((m) => m.role === "owner")
    .map((m) => m.email)
    .filter((e) => e.includes("@"));
}

/** Retrouve un utilisateur par email (null s'il n'existe pas). */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const admin = createAdminClient();
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found.id;
    if (data.users.length < 1000) return null;
    page += 1;
  }
}
