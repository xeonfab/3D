import { cn } from "@/lib/utils";

const STEPS = ["Votre marque", "Votre identité", "Votre premier produit"];

export function OnboardingShell({
  step,
  title,
  description,
  children,
  wide = false,
}: {
  step: 1 | 2 | 3;
  title: string;
  description: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <main className="flex min-h-dvh flex-col px-6 py-10">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between">
        <p className="text-sm font-medium tracking-wide">Provenance Studio</p>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Se déconnecter
          </button>
        </form>
      </header>

      <div className={cn("mx-auto mt-16 w-full", wide ? "max-w-4xl" : "max-w-xl")}>
        <ol className="mb-10 flex items-center gap-3" aria-label="Progression">
          {STEPS.map((label, i) => {
            const n = (i + 1) as 1 | 2 | 3;
            const state = n < step ? "done" : n === step ? "current" : "todo";
            return (
              <li
                key={label}
                className="flex items-center gap-3"
                aria-current={state === "current" ? "step" : undefined}
              >
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full border text-xs font-medium",
                    state === "current" && "border-foreground bg-foreground text-background",
                    state === "done" && "border-foreground/40 text-foreground/70",
                    state === "todo" && "border-border text-muted-foreground",
                  )}
                >
                  {n}
                </span>
                <span
                  className={cn(
                    "hidden text-sm sm:inline",
                    state === "todo" && "text-muted-foreground",
                  )}
                >
                  {label}
                </span>
                {i < STEPS.length - 1 ? (
                  <span aria-hidden="true" className="h-px w-6 bg-border" />
                ) : null}
              </li>
            );
          })}
        </ol>

        <h1 className="font-serif text-3xl leading-tight sm:text-4xl">{title}</h1>
        <p className="mt-3 mb-8 text-muted-foreground">{description}</p>
        {children}
      </div>
    </main>
  );
}
