"use client";

import { useActionState } from "react";
import { Loader2, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { deleteAccountAction, type FormState } from "./settings-actions";

export function DeleteAccount({
  soleOwner,
  organizationName,
}: {
  soleOwner: boolean;
  organizationName: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(deleteAccountAction, {});

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 aria-hidden="true" />
          Supprimer mon compte
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form action={action} className="contents">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer votre compte ?</AlertDialogTitle>
            <AlertDialogDescription>
              {soleOwner
                ? `Vous êtes le seul propriétaire de « ${organizationName} » : la marque, ses produits, ses vidéos, ses pages publiques et son abonnement seront supprimés définitivement.`
                : `Votre accès à « ${organizationName} » et votre compte seront supprimés. La marque et ses produits restent aux autres membres.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm-delete">Tapez SUPPRIMER pour confirmer</Label>
            <Input id="confirm-delete" name="confirm" autoComplete="off" placeholder="SUPPRIMER" />
            {state.error ? (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            ) : null}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Annuler</AlertDialogCancel>
            <AlertDialogAction
              type="submit"
              disabled={pending}
              onClick={(e) => e.stopPropagation()}
            >
              {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
