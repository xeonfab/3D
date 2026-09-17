import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireMembership } from "@/lib/auth";
import { listMembers } from "@/lib/members";
import { PLAN_LIMITS } from "@/lib/plans";
import { publicUrl } from "@/lib/storage";

import { PortalButton } from "../billing/plan-buttons";
import { BrandForm } from "./brand-form";
import { DeleteAccount } from "./delete-account";
import { MembersSection } from "./members-section";

export const metadata: Metadata = { title: "Paramètres" };

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="grid gap-6 border-t border-border py-10 lg:grid-cols-[16rem_1fr]"
    >
      <div>
        <h2 id={`${id}-title`} className="font-serif text-xl">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}

export default async function SettingsPage() {
  const { user, membership } = await requireMembership();
  const org = membership.organization;
  const isOwner = membership.role === "owner";
  const members = await listMembers(org.id);
  const soleOwner = members.filter((m) => m.role === "owner").every((m) => m.userId === user.id);

  return (
    <div className="flex flex-col">
      <div className="pb-4">
        <h1 className="font-serif text-3xl">Paramètres</h1>
        <p className="mt-1 text-muted-foreground">{org.name}</p>
      </div>

      <Section
        id="brand"
        title="Marque"
        description="Le nom, le logo et la couleur utilisés dans les vidéos et sur la page publique."
      >
        {!isOwner ? (
          <p className="mb-4 text-sm text-muted-foreground">
            Seul le propriétaire peut modifier la marque.
          </p>
        ) : null}
        <BrandForm
          name={org.name}
          color={org.brand_color}
          logoUrl={publicUrl("logos", org.logo_path)}
          canEdit={isOwner}
        />
      </Section>

      <Section
        id="members"
        title="Membres"
        description="Les personnes qui peuvent créer et modifier les produits de la marque."
      >
        <MembersSection members={members} currentUserId={user.id} isOwner={isOwner} />
      </Section>

      <Section id="billing" title="Abonnement" description={`Plan ${PLAN_LIMITS[org.plan].label}.`}>
        <div className="flex flex-wrap items-center gap-3">
          {org.plan === "pro" && isOwner ? (
            <PortalButton label="Gérer l'abonnement et les factures" returnPath="/app/settings" />
          ) : null}
          <Button asChild variant={org.plan === "pro" ? "ghost" : "default"}>
            <Link href="/app/billing">
              {org.plan === "pro" ? "Voir les plans" : "Passer au plan Pro"}
            </Link>
          </Button>
        </div>
      </Section>

      <Section
        id="danger"
        title="Suppression du compte"
        description="Action définitive. Vos données sont effacées, y compris les vidéos."
      >
        <DeleteAccount soleOwner={soleOwner} organizationName={org.name} />
      </Section>
    </div>
  );
}
