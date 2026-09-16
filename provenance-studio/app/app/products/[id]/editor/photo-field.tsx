"use client";

import { useId, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { isAcceptedPhoto, preparePhoto } from "@/lib/image";

type PhotoFieldProps = {
  photoUrl: string | null;
  onUpload: (blob: Blob) => Promise<{ ok: true } | { ok: false; error: string }>;
  onRemove: () => Promise<{ ok: true } | { ok: false; error: string }>;
};

/** Photo de l'étape : recadrée en 4:5 et compressée sous 500 Ko côté client avant envoi. */
export function PhotoField({ photoUrl, onUpload, onRemove }: PhotoFieldProps) {
  const inputId = useId();
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shown = preview ?? photoUrl;

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    if (!isAcceptedPhoto(file)) {
      setError("Choisissez une image JPEG, PNG ou WebP.");
      return;
    }
    setBusy("upload");
    try {
      const blob = await preparePhoto(file);
      const url = URL.createObjectURL(blob);
      setPreview(url);
      const result = await onUpload(blob);
      if (!result.ok) {
        setError(result.error);
        setPreview(null);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de préparer la photo.");
      setPreview(null);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("remove");
    setError(null);
    const result = await onRemove();
    if (!result.ok) setError(result.error);
    else setPreview(null);
    setBusy(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={inputId}>Photo</Label>
      <div className="flex items-start gap-4">
        <div className="relative aspect-[4/5] w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element -- aperçu local ou Storage
            <img src={shown} alt="Photo de l'étape" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <ImagePlus aria-hidden="true" className="size-5" />
            </div>
          )}
          {busy === "upload" ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Loader2 aria-hidden="true" className="size-5 animate-spin text-white" />
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="cursor-pointer">
              <label htmlFor={inputId}>
                <ImagePlus aria-hidden="true" />
                {shown ? "Changer" : "Ajouter une photo"}
              </label>
            </Button>
            {shown ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={remove}
                disabled={busy !== null}
              >
                {busy === "remove" ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 aria-hidden="true" />
                )}
                Retirer
              </Button>
            ) : null}
          </div>
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={onChange}
            disabled={busy !== null}
            aria-describedby={`${inputId}-hint`}
          />
          <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">
            Recadrée automatiquement au format 4:5 et compressée. Facultative.
          </p>
          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
