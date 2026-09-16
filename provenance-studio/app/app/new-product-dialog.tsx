"use client";

import { useActionState, useState } from "react";
import { Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createProductAction, type NewProductState } from "./actions";

export function NewProductDialog({ disabled }: { disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<NewProductState, FormData>(
    createProductAction,
    {},
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={disabled} aria-disabled={disabled}>
          <Plus aria-hidden="true" />
          Nouveau produit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={formAction} className="contents" noValidate>
          <DialogHeader>
            <DialogTitle>Nouveau produit</DialogTitle>
            <DialogDescription>
              Donnez-lui le nom qui figure sur l&apos;emballage. Vous décrirez son voyage ensuite.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-product-name">Nom du produit</Label>
            <Input
              id="new-product-name"
              name="name"
              required
              maxLength={80}
              autoFocus
              placeholder="Éthiopie Guji nature"
              aria-invalid={state.error ? true : undefined}
            />
            {state.error ? (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Créer et ouvrir l&apos;éditeur
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
