"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import type { RenderView } from "@/lib/render/service";
import type { RenderFormat } from "@/lib/supabase/types";

import { getRendersAction, startRendersAction, type RenderOverview } from "../render-actions";
import { SharePanel } from "./share-panel";

type GenerateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  initial: RenderOverview;
  plan: { isFree: boolean; resolution: string; watermark: boolean };
  onRendersChange?: (renders: RenderView[]) => void;
};

const FORMATS: { value: RenderFormat; label: string; hint: string }[] = [
  { value: "vertical", label: "9:16 vertical", hint: "Réseaux sociaux, page publique, QR code" },
  { value: "horizontal", label: "16:9 horizontal", hint: "Site web, salons, écrans" },
];

const POLL_MS = 3000;

function formatEstimate(seconds: number): string {
  const min = Math.max(1, Math.round(seconds / 60));
  return min === 1 ? "environ une minute" : `environ ${min} minutes`;
}

export function GenerateDialog({
  open,
  onOpenChange,
  productId,
  initial,
  plan,
  onRendersChange,
}: GenerateDialogProps) {
  const [overview, setOverview] = useState<RenderOverview>(initial);
  const [selected, setSelected] = useState<RenderFormat[]>(["vertical", "horizontal"]);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = overview.renders.some((r) => r.status === "queued" || r.status === "rendering");
  const hasAny = overview.renders.length > 0;

  const refresh = useCallback(async () => {
    const r = await getRendersAction(productId);
    if (r.ok) {
      setOverview(r.data);
      onRendersChange?.(r.data.renders);
    }
  }, [productId, onRendersChange]);

  // Polling toutes les 3 s tant qu'un rendu est en cours et que la modale est ouverte.
  useEffect(() => {
    if (!open || !active) return;
    timer.current = setTimeout(() => void refresh(), POLL_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [open, active, overview, refresh]);

  async function launch(formats: RenderFormat[]) {
    setLaunching(true);
    setError(null);
    const r = await startRendersAction(productId, formats);
    setLaunching(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setOverview(r.data);
    onRendersChange?.(r.data.renders);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Générer la vidéo</DialogTitle>
          <DialogDescription>
            {plan.isFree
              ? "Plan gratuit : vidéo en 720p avec le filigrane « Provenance Studio ». Passez au plan Pro pour du 1080p sans filigrane."
              : "Plan Pro : vidéo en 1080p, sans filigrane."}
          </DialogDescription>
        </DialogHeader>

        {!hasAny || (!active && overview.renders.every((r) => r.status === "failed")) ? (
          <div className="flex flex-col gap-5">
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-2 text-sm font-medium">Formats</legend>
              {FORMATS.map((f) => {
                const id = `format-${f.value}`;
                const checked = selected.includes(f.value);
                return (
                  <div key={f.value} className="flex items-start gap-3">
                    <Checkbox
                      id={id}
                      checked={checked}
                      onCheckedChange={(v) =>
                        setSelected((s) =>
                          v ? [...new Set([...s, f.value])] : s.filter((x) => x !== f.value),
                        )
                      }
                      className="mt-0.5"
                    />
                    <Label htmlFor={id} className="flex flex-col items-start gap-0.5 font-normal">
                      <span className="font-medium">{f.label}</span>
                      <span className="text-xs text-muted-foreground">{f.hint}</span>
                    </Label>
                  </div>
                );
              })}
            </fieldset>
            <p className="text-sm text-muted-foreground">
              Durée estimée : {formatEstimate(overview.estimateSeconds)} par format. Vous recevrez
              un email quand la vidéo sera prête.
            </p>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end">
              <Button
                onClick={() => void launch(selected)}
                disabled={launching || selected.length === 0}
              >
                {launching ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                Lancer la génération
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <ul className="grid gap-4 sm:grid-cols-2">
              {overview.renders.map((r) => (
                <li key={r.id} className="flex flex-col gap-3 rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {FORMATS.find((f) => f.value === r.format)?.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.status === "done"
                        ? "Prête"
                        : r.status === "failed"
                          ? "Échec"
                          : r.status === "queued"
                            ? "En file d'attente"
                            : `${r.progress} %`}
                    </p>
                  </div>

                  {r.status === "queued" || r.status === "rendering" ? (
                    <>
                      <Progress
                        value={r.progress}
                        aria-label={`Progression du rendu ${FORMATS.find((f) => f.value === r.format)?.label}`}
                      />
                      <p className="text-xs text-muted-foreground">
                        Rendu en cours, {formatEstimate(overview.estimateSeconds)}. Vous pouvez
                        fermer cette fenêtre.
                      </p>
                    </>
                  ) : null}

                  {r.status === "done" && r.videoUrl ? (
                    <>
                      <video
                        src={r.videoUrl}
                        poster={r.thumbnailUrl ?? undefined}
                        controls
                        playsInline
                        preload="metadata"
                        className={
                          r.format === "vertical"
                            ? "mx-auto max-h-72 rounded-md bg-black"
                            : "w-full rounded-md bg-black"
                        }
                      />
                      <Button asChild variant="outline" size="sm">
                        <a href={r.videoUrl} download>
                          <Download aria-hidden="true" />
                          Télécharger le MP4
                        </a>
                      </Button>
                    </>
                  ) : null}

                  {r.status === "failed" ? (
                    <>
                      <p className="text-sm text-destructive">{r.error}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void launch([r.format])}
                        disabled={launching}
                      >
                        <RefreshCw aria-hidden="true" />
                        Réessayer
                      </Button>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>

            {overview.publicUrl &&
            overview.embedSnippet &&
            overview.renders.some((r) => r.status === "done") ? (
              <div className="border-t border-border pt-4">
                <SharePanel
                  productId={productId}
                  publicUrl={overview.publicUrl}
                  embedSnippet={overview.embedSnippet}
                />
              </div>
            ) : null}

            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}

            {!active ? (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void launch(selected)}
                  disabled={launching}
                >
                  {launching ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : (
                    <RefreshCw aria-hidden="true" />
                  )}
                  Générer à nouveau
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
