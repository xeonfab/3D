import "server-only";

import Stripe from "stripe";

import type { PlanType } from "@/lib/supabase/types";

let client: Stripe | null = null;

/** Client Stripe (clé secrète serveur). Lève une erreur explicite si la clé manque. */
export function getStripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY manquante.");
  client = new Stripe(key, { typescript: true });
  return client;
}

export function proPriceId(): string {
  const id = process.env.STRIPE_PRICE_PRO_MONTHLY;
  if (!id) throw new Error("STRIPE_PRICE_PRO_MONTHLY manquante.");
  return id;
}

/**
 * Plan correspondant au statut d'un abonnement Stripe.
 *   active / trialing / past_due → pro (Stripe relance le paiement, l'accès reste ouvert)
 *   canceled / unpaid / incomplete / incomplete_expired / paused → free
 * Une annulation programmée (cancel_at_period_end) reste `pro` jusqu'à la
 * fin de la période : Stripe envoie alors `customer.subscription.deleted`.
 */
export function planForSubscriptionStatus(
  status: Stripe.Subscription.Status | null | undefined,
): PlanType {
  return status === "active" || status === "trialing" || status === "past_due" ? "pro" : "free";
}
