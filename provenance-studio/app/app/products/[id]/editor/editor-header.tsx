"use client";

import Link from "next/link";
import { ArrowLeft, Check, CloudOff, Loader2, Share2, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type { EditorProduct, SaveStatus } from "./types";

type EditorHeaderProps = {
  product: EditorProduct;
  saveStatus: SaveStatus;
  saveError: string | null;
  onChange: (patch: Partial<Pick<EditorProduct, "name" | "end_line">>) => void;
  onGenerate?: () => void;
  generating?: boolean;
  generateDisabledReason?: string;
  onShare?: () => void;
};

export function EditorHeader({
  product,
  saveStatus,
  saveError,
  onChange,
  onGenerate,
  generating,
  generateDisabledReason,
  onShare,
}: EditorHeaderProps) {
  const status =
    saveStatus === "saving"
      ? { icon: Loader2, text: "Enregistrement…", cls: "text-muted-foreground", spin: true }
      : saveStatus === "error"
        ? {
            icon: CloudOff,
            text: saveError ?? "Enregistrement impossible",
            cls: "text-destructive",
            spin: false,
          }
        : { icon: Check, text: "Enregistré", cls: "text-muted-foreground", spin: false };
  const StatusIcon = status.icon;

  return (
    <header className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/app">
            <ArrowLeft aria-hidden="true" />
            Tous les produits
          </Link>
        </Button>
        <p
          role="status"
          aria-live="polite"
          className={cn("inline-flex items-center gap-1.5 text-sm", status.cls)}
        >
          <StatusIcon className={cn("size-4", status.spin && "animate-spin")} aria-hidden="true" />
          {status.text}
        </p>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div>
            <Label htmlFor="product-name" className="sr-only">
              Nom du produit
            </Label>
            <Input
              id="product-name"
              value={product.name}
              maxLength={80}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="Nom du produit"
              className="h-auto border-transparent bg-transparent px-1 py-1 font-serif text-3xl shadow-none hover:border-input focus-visible:border-ring md:text-3xl"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="product-end-line" className="text-xs text-muted-foreground">
              Ligne de fin de la vidéo
            </Label>
            <Input
              id="product-end-line"
              value={product.end_line}
              maxLength={140}
              onChange={(e) => onChange({ end_line: e.target.value })}
              placeholder="Récolté en janvier. Torréfié mardi dernier."
              className="max-w-xl border-transparent bg-transparent px-1 font-serif shadow-none hover:border-input focus-visible:border-ring"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onShare ? (
            <Button type="button" variant="outline" size="lg" onClick={onShare}>
              <Share2 aria-hidden="true" />
              Partager
            </Button>
          ) : null}
          {generateDisabledReason ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  className="inline-block w-fit rounded-md focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Button type="button" size="lg" disabled>
                    <Video aria-hidden="true" />
                    Générer la vidéo
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{generateDisabledReason}</TooltipContent>
            </Tooltip>
          ) : (
            <Button type="button" size="lg" onClick={onGenerate}>
              {generating ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Video aria-hidden="true" />
              )}
              {generating ? "Vidéo en cours…" : "Générer la vidéo"}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
