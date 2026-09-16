import type { Metadata } from "next";

export const metadata: Metadata = { title: "Paramètres" };

/** Phase 5 : marque, membres, abonnement, suppression du compte. */
export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-serif text-3xl">Paramètres</h1>
      <p className="text-muted-foreground">
        Les paramètres de la marque et des membres arrivent dans une prochaine étape du chantier.
      </p>
    </div>
  );
}
