"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Le détail technique va dans la console (et les logs Vercel), jamais à l'écran.
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Erreur</p>
      <h1 className="font-serif text-4xl">Quelque chose s&apos;est mal passé.</h1>
      <p className="max-w-md text-muted-foreground">
        Nous n&apos;avons pas pu afficher cette page. Réessayez, et si le problème persiste,
        contactez-nous.
        {error.digest ? (
          <span className="block pt-2 text-xs">Référence : {error.digest}</span>
        ) : null}
      </p>
      <div className="flex gap-3">
        <Button onClick={reset}>Réessayer</Button>
        <Button asChild variant="outline">
          <Link href="/app">Retour à l&apos;accueil</Link>
        </Button>
      </div>
    </main>
  );
}
