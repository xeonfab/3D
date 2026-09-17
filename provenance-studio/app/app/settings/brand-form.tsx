"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { Loader2, Upload } from "lucide-react";

import { BrandPreview } from "@/components/map/brand-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { updateBrandAction, type FormState } from "./settings-actions";

const HEX = /^#[0-9A-Fa-f]{6}$/;

export function BrandForm({
  name,
  color,
  logoUrl,
  canEdit,
}: {
  name: string;
  color: string;
  logoUrl: string | null;
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateBrandAction, {});
  const [brandName, setBrandName] = useState(name);
  const [hex, setHex] = useState(color.toUpperCase());
  const [preview, setPreview] = useState<string | null>(logoUrl);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileId = useId();
  const validColor = HEX.test(hex) ? hex : color;

  useEffect(
    () => () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  return (
    <form action={action} className="grid gap-8 lg:grid-cols-[1fr_1fr]">
      <fieldset disabled={!canEdit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="brand-name">Nom de la marque</Label>
          <Input
            id="brand-name"
            name="name"
            value={brandName}
            maxLength={80}
            onChange={(e) => setBrandName(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={fileId}>Logo</Label>
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="sm" className="cursor-pointer">
              <label htmlFor={fileId}>
                <Upload aria-hidden="true" />
                {preview ? "Changer le logo" : "Choisir un fichier"}
              </label>
            </Button>
            <span className="text-sm text-muted-foreground">
              {fileName ?? (logoUrl ? "Logo actuel conservé" : "Aucun logo")}
            </span>
          </div>
          <input
            id={fileId}
            name="logo"
            type="file"
            accept="image/png,image/svg+xml"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setPreview(URL.createObjectURL(f));
              setFileName(f.name);
            }}
          />
          <p className="text-xs text-muted-foreground">
            PNG ou SVG, 2 Mo maximum, fond transparent recommandé.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="brand-color">Couleur de marque</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              aria-label="Sélecteur de couleur"
              value={validColor}
              onChange={(e) => setHex(e.target.value.toUpperCase())}
              className="size-10 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-1"
            />
            <Input
              id="brand-color"
              name="brand_color"
              value={hex}
              maxLength={7}
              onChange={(e) => setHex(e.target.value.toUpperCase())}
              className="max-w-[9rem] font-mono uppercase"
              aria-invalid={!HEX.test(hex) ? true : undefined}
            />
          </div>
        </div>
        {state.error ? (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p role="status" className="text-sm text-success">
            {state.success}
          </p>
        ) : null}
        <div>
          <Button type="submit" disabled={pending || !HEX.test(hex) || !brandName.trim()}>
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Enregistrer
          </Button>
        </div>
      </fieldset>
      <div>
        <p className="mb-3 text-sm text-muted-foreground">Aperçu</p>
        <BrandPreview name={brandName} color={validColor} logoUrl={preview} />
      </div>
    </form>
  );
}
