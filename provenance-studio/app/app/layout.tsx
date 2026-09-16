import { AppShell } from "@/components/app-shell";
import { requireMembership } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, membership } = await requireMembership();

  return (
    <AppShell organizationName={membership.organization.name} userEmail={user.email ?? ""}>
      {children}
    </AppShell>
  );
}
