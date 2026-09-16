"use client";

import { useActionState } from "react";
import { Loader2, MailCheck } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { sendMagicLink, type MagicLinkState } from "./actions";

const initialState: MagicLinkState = { status: "idle" };

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(sendMagicLink, initialState);

  if (state.status === "sent") {
    return (
      <Alert variant="success">
        <MailCheck aria-hidden="true" />
        <AlertTitle>Vérifiez votre boîte mail</AlertTitle>
        <AlertDescription>
          <p>
            Un lien de connexion a été envoyé à <strong>{state.email}</strong>. Il est valable une
            heure. Pensez à vérifier vos courriers indésirables.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Adresse email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          placeholder="vous@votre-marque.fr"
          aria-describedby="email-hint"
          aria-invalid={state.status === "error" ? true : undefined}
        />
        <p id="email-hint" className="text-sm text-muted-foreground">
          Aucun mot de passe : vous recevrez un lien de connexion par email.
        </p>
      </div>

      {state.status === "error" ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        {pending ? "Envoi en cours…" : "Recevoir mon lien de connexion"}
      </Button>
    </form>
  );
}
