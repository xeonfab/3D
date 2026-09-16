import Link from "next/link";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

type AppShellProps = {
  organizationName: string;
  userEmail: string;
  children: React.ReactNode;
};

const NAV = [
  { href: "/app", label: "Produits" },
  { href: "/app/settings", label: "Paramètres" },
  { href: "/app/billing", label: "Abonnement" },
];

export function AppShell({ organizationName, userEmail, children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Aller au contenu
      </a>
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-6 px-6">
          <div className="flex items-center gap-8">
            <Link href="/app" className="text-sm font-medium tracking-wide">
              Provenance Studio
            </Link>
            <nav aria-label="Navigation principale" className="hidden items-center gap-1 md:flex">
              {NAV.map((item) => (
                <Button key={item.href} asChild variant="ghost" size="sm">
                  <Link href={item.href}>{item.label}</Link>
                </Button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm">{organizationName}</p>
              <p className="text-xs text-muted-foreground">{userEmail}</p>
            </div>
            <form action="/auth/signout" method="post">
              <Button type="submit" variant="ghost" size="icon" aria-label="Se déconnecter">
                <LogOut aria-hidden="true" />
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main id="contenu" className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        {children}
      </main>
    </div>
  );
}
