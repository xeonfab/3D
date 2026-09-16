"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createFirstProduct, type FormState } from "./actions";

export function StepFirstProduct() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createFirstProduct, {});
  const [name, setName] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nom du produit</Label>
        <Input
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          required
          maxLength={80}
          placeholder="Éthiopie Guji nature"
          aria-describedby="product-hint"
          aria-invalid={state.error ? true : undefined}
        />
        <p id="product-hint" className="text-sm text-muted-foreground">
          Tel qu&apos;il apparaît sur l&apos;emballage. Vous pourrez le modifier ensuite.
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
          Ouvrir l&apos;éditeur
          {!pending ? <ArrowRight aria-hidden="true" /> : null}
        </Button>
      </div>
    </form>
  );
}
