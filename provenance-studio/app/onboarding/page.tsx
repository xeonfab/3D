import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getMembership, requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Bienvenue" };

/** Phase 1 : parcours en trois écrans. Pour l'instant, écran d'attente. */
export default async function OnboardingPage() {
  await requireUser("/onboarding");
  const membership = await getMembership();
  if (membership) redirect("/app");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Bienvenue</p>
      <h1 className="font-serif text-3xl">Créons votre marque.</h1>
      <p className="max-w-md text-muted-foreground">
        L&apos;onboarding arrive dans la prochaine étape du chantier. Votre compte est bien créé.
      </p>
      <form action="/auth/signout" method="post">
        <button type="submit" className="text-sm underline underline-offset-4">
          Se déconnecter
        </button>
      </form>
    </main>
  );
}
