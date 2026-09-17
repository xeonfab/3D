import "server-only";

import type Stripe from "stripe";

import { publicEnv } from "@/lib/env";
import { getStripe, planForSubscriptionStatus, proPriceId } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OrganizationRow, PlanType } from "@/lib/supabase/types";

const site = () => publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");

/** Client Stripe de l'organisation, créé au premier besoin. */
export async function ensureCustomer(org: OrganizationRow, email: string): Promise<string> {
  if (org.stripe_customer_id) return org.stripe_customer_id;
  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email,
    name: org.name,
    metadata: { organization_id: org.id },
  });
  const admin = createAdminClient();
  await admin.from("organizations").update({ stripe_customer_id: customer.id }).eq("id", org.id);
  return customer.id;
}

export async function createCheckoutUrl(org: OrganizationRow, email: string): Promise<string> {
  const stripe = getStripe();
  const customer = await ensureCustomer(org, email);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price: proPriceId(), quantity: 1 }],
    client_reference_id: org.id,
    subscription_data: { metadata: { organization_id: org.id } },
    allow_promotion_codes: true,
    locale: "fr",
    success_url: `${site()}/app/billing?succes=1`,
    cancel_url: `${site()}/app/billing`,
  });
  if (!session.url) throw new Error("Stripe n'a pas renvoyé d'URL de paiement.");
  return session.url;
}

export async function createPortalUrl(
  org: OrganizationRow,
  email: string,
  returnPath = "/app/settings",
): Promise<string> {
  const stripe = getStripe();
  const customer = await ensureCustomer(org, email);
  const session = await stripe.billingPortal.sessions.create({
    customer,
    return_url: `${site()}${returnPath}`,
    locale: "fr",
  });
  return session.url;
}

export type SubscriptionSummary = {
  status: Stripe.Subscription.Status;
  /** Fin de la période en cours (ISO). */
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

/** Résumé de l'abonnement en cours (null si aucun). */
export async function getSubscriptionSummary(
  org: OrganizationRow,
): Promise<SubscriptionSummary | null> {
  if (!org.stripe_subscription_id) return null;
  try {
    const sub = await getStripe().subscriptions.retrieve(org.stripe_subscription_id);
    const item = sub.items.data[0];
    return {
      status: sub.status,
      currentPeriodEnd: item?.current_period_end
        ? new Date(item.current_period_end * 1000).toISOString()
        : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    };
  } catch (err) {
    console.error("[billing] getSubscriptionSummary", err);
    return null;
  }
}

/** Annule immédiatement l'abonnement (suppression du compte). */
export async function cancelSubscriptionNow(org: OrganizationRow): Promise<void> {
  if (!org.stripe_subscription_id) return;
  try {
    await getStripe().subscriptions.cancel(org.stripe_subscription_id);
  } catch (err) {
    console.error("[billing] cancelSubscriptionNow", err);
  }
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

export type PlanUpdate = {
  organizationId: string;
  plan: PlanType;
  stripeCustomerId?: string;
  stripeSubscriptionId: string | null;
};

export type WebhookDeps = {
  /** Applique un changement de plan (null = pas de changement). */
  applyPlan: (update: PlanUpdate) => Promise<void>;
  /** Retrouve l'organisation par client Stripe. */
  organizationIdForCustomer: (customerId: string) => Promise<string | null>;
  /** Paiement échoué : prévenir les propriétaires. */
  notifyPaymentFailed: (organizationId: string) => Promise<void>;
};

const customerId = (c: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null =>
  typeof c === "string" ? c : (c?.id ?? null);

/**
 * Traduit un événement Stripe en changement de plan. Pur (dépendances
 * injectées) pour être testable sans base ni réseau.
 *   checkout.session.completed            → pro
 *   customer.subscription.created/updated → selon le statut (réactivation incluse)
 *   customer.subscription.deleted         → free
 *   invoice.payment_failed                → email, plan inchangé (Stripe relance)
 */
export async function handleStripeEvent(event: Stripe.Event, deps: WebhookDeps): Promise<string> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode !== "subscription") return "ignoré (mode)";
      const orgId =
        session.client_reference_id ??
        (await deps.organizationIdForCustomer(customerId(session.customer) ?? ""));
      if (!orgId) return "organisation introuvable";
      await deps.applyPlan({
        organizationId: orgId,
        plan: "pro",
        stripeCustomerId: customerId(session.customer) ?? undefined,
        stripeSubscriptionId:
          typeof session.subscription === "string"
            ? session.subscription
            : (session.subscription?.id ?? null),
      });
      return "pro";
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object;
      const orgId =
        sub.metadata?.organization_id ||
        (await deps.organizationIdForCustomer(customerId(sub.customer) ?? ""));
      if (!orgId) return "organisation introuvable";
      const plan = planForSubscriptionStatus(sub.status);
      await deps.applyPlan({
        organizationId: orgId,
        plan,
        stripeCustomerId: customerId(sub.customer) ?? undefined,
        stripeSubscriptionId: plan === "pro" ? sub.id : sub.id,
      });
      return plan;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const orgId =
        sub.metadata?.organization_id ||
        (await deps.organizationIdForCustomer(customerId(sub.customer) ?? ""));
      if (!orgId) return "organisation introuvable";
      await deps.applyPlan({ organizationId: orgId, plan: "free", stripeSubscriptionId: null });
      return "free";
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const orgId = await deps.organizationIdForCustomer(customerId(invoice.customer) ?? "");
      if (orgId) await deps.notifyPaymentFailed(orgId);
      return "paiement échoué";
    }
    default:
      return "ignoré";
  }
}

/** Dépendances réelles du webhook (base Supabase + emails). */
export function productionWebhookDeps(
  notify: (organizationId: string) => Promise<void>,
): WebhookDeps {
  const admin = createAdminClient();
  return {
    applyPlan: async ({ organizationId, plan, stripeCustomerId, stripeSubscriptionId }) => {
      const patch: Partial<OrganizationRow> = {
        plan,
        stripe_subscription_id: stripeSubscriptionId,
      };
      if (stripeCustomerId) patch.stripe_customer_id = stripeCustomerId;
      const { error } = await admin.from("organizations").update(patch).eq("id", organizationId);
      if (error) throw error;
    },
    organizationIdForCustomer: async (customer) => {
      if (!customer) return null;
      const { data } = await admin
        .from("organizations")
        .select("id")
        .eq("stripe_customer_id", customer)
        .maybeSingle();
      return data?.id ?? null;
    },
    notifyPaymentFailed: notify,
  };
}
