"use client";

import { useState } from "react";
import { Check, Code2, Copy, ExternalLink, QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";

type SharePanelProps = {
  productId: string;
  publicUrl: string;
  embedSnippet: string;
};

/** Lien public, QR code à imprimer et snippet d'intégration. */
export function SharePanel({ productId, publicUrl, embedSnippet }: SharePanelProps) {
  const [copied, setCopied] = useState<"link" | "embed" | null>(null);

  async function copy(kind: "link" | "embed", text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium">Page publique</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void copy("link", publicUrl)}>
            {copied === "link" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied === "link" ? "Lien copié" : "Copier le lien"}
          </Button>
          <Button asChild variant="ghost" size="sm">
            <a href={publicUrl} target="_blank" rel="noopener">
              <ExternalLink aria-hidden="true" />
              Ouvrir
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/products/${productId}/qr`} download>
              <QrCode aria-hidden="true" />
              Télécharger le QR code
            </a>
          </Button>
        </div>
        <p className="truncate text-xs text-muted-foreground">{publicUrl}</p>
        <p className="text-xs text-muted-foreground">
          QR code PNG 1024 px, à imprimer sur l&apos;emballage. Il pointe vers la page publique et
          compte les scans.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium">Intégrer sur votre site</p>
        <div className="flex items-start gap-2">
          <pre className="min-w-0 flex-1 overflow-x-auto rounded-md border border-border bg-muted/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            <code>{embedSnippet}</code>
          </pre>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void copy("embed", embedSnippet)}
            aria-label="Copier le code d'intégration"
          >
            {copied === "embed" ? <Check aria-hidden="true" /> : <Code2 aria-hidden="true" />}
            {copied === "embed" ? "Copié" : "Copier"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Fonctionne sur Shopify, WooCommerce et tout site acceptant du HTML.
        </p>
      </div>
    </div>
  );
}
