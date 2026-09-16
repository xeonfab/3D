import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Erreur 404</p>
      <h1 className="font-serif text-4xl">Cette page n&apos;existe pas.</h1>
      <p className="max-w-md text-muted-foreground">
        Le lien est peut-être erroné, ou la page a été retirée par la marque.
      </p>
      <Button asChild variant="outline">
        <Link href="/">Retour à l&apos;accueil</Link>
      </Button>
    </main>
  );
}
