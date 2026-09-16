import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getMembership, requireUser } from "@/lib/auth";
import { publicUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

import { OnboardingShell } from "./onboarding-shell";
import { StepBrandIdentity } from "./step-brand-identity";
import { StepBrandName } from "./step-brand-name";
import { StepFirstProduct } from "./step-first-product";

export const metadata: Metadata = { title: "Bienvenue" };

/**
 * Onboarding en trois écrans, une question par écran :
 *   1. nom de la marque (crée l'organisation)
 *   2. logo + couleur, avec aperçu en direct
 *   3. premier produit (crée le produit et ouvre l'éditeur)
 * L'étape est dans l'URL (`?etape=`) et vérifiée côté serveur.
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ etape?: string }>;
}) {
  await requireUser("/onboarding");
  const membership = await getMembership();
  const { etape } = await searchParams;
  const requested = Number.parseInt(etape ?? "1", 10);

  if (!membership) {
    if (requested !== 1) redirect("/onboarding");
    return (
      <OnboardingShell
        step={1}
        title="Comment s'appelle votre marque ?"
        description="C'est le nom que vos clients verront sur la page publique et dans les vidéos."
      >
        <StepBrandName />
      </OnboardingShell>
    );
  }

  const org = membership.organization;
  const supabase = await createClient();
  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id);
  if ((count ?? 0) > 0) redirect("/app");

  if (requested === 3) {
    return (
      <OnboardingShell
        step={3}
        title="Quel est votre premier produit ?"
        description="Vous décrirez ensuite son voyage, étape par étape, sur la carte."
      >
        <StepFirstProduct />
      </OnboardingShell>
    );
  }

  if (requested !== 2) redirect("/onboarding?etape=2");
  return (
    <OnboardingShell
      step={2}
      title="Votre logo et votre couleur"
      description="Ils habillent chaque vidéo et la page publique. Vous pourrez les changer dans les paramètres."
      wide
    >
      <StepBrandIdentity
        organizationName={org.name}
        initialColor={org.brand_color}
        initialLogoUrl={publicUrl("logos", org.logo_path)}
      />
    </OnboardingShell>
  );
}
