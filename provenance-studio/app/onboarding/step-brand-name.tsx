"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { slugify } from "@/lib/slug";

import { createOrganization, type FormState } from "./actions";

export function StepBrandName() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createOrganization, {});
  const [name, setName] = useState("");
  const slug = slugify(name, 50);

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nom de la marque</Label>
        <Input
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          required
          maxLength={80}
          autoComplete="organization"
          placeholder="Torréfaction Lucie"
          aria-describedby="name-hint"
          aria-invalid={state.error ? true : undefined}
        />
        <p id="name-hint" className="text-sm text-muted-foreground" aria-live="polite">
          {slug ? (
            <>
              Identifiant : <span className="font-mono text-foreground">{slug}</span>
            </>
          ) : (
            "Un identifiant court sera généré à partir du nom."
          )}
        </p>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <div>
        <Button type="submit" size="lg" disabled={pending || !name.trim()}>
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Continuer
          {!pending ? <ArrowRight aria-hidden="true" /> : null}
        </Button>
      </div>
    </form>
  );
}
