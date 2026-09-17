"use client";

import { useActionState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import { openPortalAction, startCheckoutAction, type BillingState } from "./billing-actions";

export function CheckoutButton({ disabled, reason }: { disabled?: boolean; reason?: string }) {
  const [state, action, pending] = useActionState<BillingState, FormData>(
    () => startCheckoutAction(),
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-2">
      <Button
        type="submit"
        size="lg"
        disabled={disabled || pending}
        aria-describedby={reason ? "checkout-reason" : undefined}
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        Passer au plan Pro
      </Button>
      {reason ? (
        <p id="checkout-reason" className="text-xs text-muted-foreground">
          {reason}
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function PortalButton({
  label = "Gérer l'abonnement",
  returnPath = "/app/billing",
  variant = "outline" as const,
}) {
  const [state, action, pending] = useActionState<BillingState, FormData>(
    () => openPortalAction(returnPath),
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-2">
      <Button type="submit" variant={variant} disabled={pending}>
        {pending ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <ExternalLink aria-hidden="true" />
        )}
        {label}
      </Button>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
