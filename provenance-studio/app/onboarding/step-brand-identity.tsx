"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { ArrowRight, Loader2, Upload } from "lucide-react";

import { BrandPreview } from "@/components/map/brand-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { updateBrand, type FormState } from "./actions";

const HEX = /^#[0-9A-Fa-f]{6}$/;

export function StepBrandIdentity({
  organizationName,
  initialColor,
  initialLogoUrl,
}: {
  organizationName: string;
  initialColor: string;
  initialLogoUrl: string | null;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateBrand, {});
  const [hex, setHex] = useState(initialColor.toUpperCase());
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);
  const [logoName, setLogoName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputId = useId();

  const validColor = HEX.test(hex) ? hex : initialColor;

  useEffect(() => {
    return () => {
      if (logoUrl?.startsWith("blob:")) URL.revokeObjectURL(logoUrl);
    };
  }, [logoUrl]);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setFileError(null);
    if (!file) return;
    if (!["image/png", "image/svg+xml"].includes(file.type)) {
      setFileError("Le logo doit être un fichier PNG ou SVG.");
      e.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setFileError("Le logo ne doit pas dépasser 2 Mo.");
      e.target.value = "";
      return;
    }
    setLogoUrl(URL.createObjectURL(file));
    setLogoName(file.name);
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
      <form action={formAction} className="flex flex-col gap-8" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor={fileInputId}>Logo</Label>
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" className="cursor-pointer">
              <label htmlFor={fileInputId}>
                <Upload aria-hidden="true" />
                {logoUrl ? "Changer le logo" : "Choisir un fichier"}
              </label>
            </Button>
            <span className="truncate text-sm text-muted-foreground" aria-live="polite">
              {logoName ?? (initialLogoUrl ? "Logo actuel conservé" : "Aucun fichier choisi")}
            </span>
          </div>
          <input
            id={fileInputId}
            name="logo"
            type="file"
            accept="image/png,image/svg+xml"
            className="sr-only"
            onChange={onFileChange}
            aria-describedby="logo-hint"
          />
          <p id="logo-hint" className="text-sm text-muted-foreground">
            PNG ou SVG, 2 Mo maximum. Fond transparent recommandé : le logo s&apos;affiche sur la
            carte sombre. Facultatif, mais il ouvre chaque vidéo.
          </p>
          {fileError ? (
            <p role="alert" className="text-sm text-destructive">
              {fileError}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="brand_color">Couleur de marque</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              aria-label="Sélecteur de couleur"
              value={validColor}
              onChange={(e) => setHex(e.target.value.toUpperCase())}
              className="size-10 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-1"
            />
            <Input
              id="brand_color"
              name="brand_color"
              value={hex}
              onChange={(e) => setHex(e.target.value.toUpperCase())}
              maxLength={7}
              spellCheck={false}
              className="max-w-[9rem] font-mono uppercase"
              aria-describedby="color-hint"
              aria-invalid={!HEX.test(hex) ? true : undefined}
            />
          </div>
          <p id="color-hint" className="text-sm text-muted-foreground">
            Elle colore le tracé et les points sur la carte. Préférez une teinte lisible sur fond
            sombre.
          </p>
        </div>

        {state.error ? (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : null}

        <div>
          <Button type="submit" size="lg" disabled={pending || !HEX.test(hex)}>
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Continuer
            {!pending ? <ArrowRight aria-hidden="true" /> : null}
          </Button>
        </div>
      </form>

      <div>
        <p className="mb-3 text-sm text-muted-foreground">Aperçu dans la vidéo</p>
        <BrandPreview name={organizationName} color={validColor} logoUrl={logoUrl} />
      </div>
    </div>
  );
}
