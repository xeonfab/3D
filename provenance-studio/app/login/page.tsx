import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

const ERROR_MESSAGES: Record<string, string> = {
  expired: "Ce lien de connexion a expiré ou a déjà été utilisé. Demandez-en un nouveau.",
  invalid: "Ce lien de connexion n'est pas valide. Demandez-en un nouveau.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; deleted?: string }>;
}) {
  const { next, error, deleted } = await searchParams;
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.invalid) : null;

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-[oklch(0.13_0.006_60)] lg:block">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 30%, oklch(0.3 0.02 60 / 0.6), transparent 45%), radial-gradient(circle at 70% 70%, oklch(0.25 0.015 60 / 0.6), transparent 40%), linear-gradient(oklch(1 0 0 / 0.035) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 0.035) 1px, transparent 1px)",
            backgroundSize: "auto, auto, 48px 48px, 48px 48px",
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-12">
          <p className="text-sm font-medium tracking-wide">Provenance Studio</p>
          <div className="max-w-md">
            <p className="font-serif text-4xl leading-tight">
              Chaque produit a un voyage. Montrez-le, exactement, sur une carte.
            </p>
            <p className="mt-4 text-muted-foreground">
              De la ferme à l&apos;atelier : une vidéo animée, une page publique et un QR code pour
              votre emballage, sans vidéaste ni compétence technique.
            </p>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <p className="mb-10 text-sm font-medium tracking-wide lg:hidden">Provenance Studio</p>
          <h1 className="font-serif text-3xl">Connexion</h1>
          <p className="mt-2 mb-8 text-muted-foreground">
            Entrez votre adresse email pour vous connecter ou créer votre compte.
          </p>
          {deleted === "1" ? (
            <p
              role="status"
              className="mb-6 rounded-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground"
            >
              Votre compte a été supprimé. Merci d&apos;avoir utilisé Provenance Studio.
            </p>
          ) : null}
          {errorMessage ? (
            <p
              role="alert"
              className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {errorMessage}
            </p>
          ) : null}
          <LoginForm next={next} />
        </div>
      </section>
    </main>
  );
}
