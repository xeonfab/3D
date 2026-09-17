import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";

import { handleStripeEvent, type PlanUpdate, type WebhookDeps } from "@/lib/billing";
import { planForSubscriptionStatus } from "@/lib/stripe";

function deps() {
  const updates: PlanUpdate[] = [];
  const notified: string[] = [];
  const d: WebhookDeps = {
    applyPlan: async (u) => {
      updates.push(u);
    },
    organizationIdForCustomer: async (c) => (c === "cus_1" ? "org-1" : null),
    notifyPaymentFailed: async (id) => {
      notified.push(id);
    },
  };
  return { d, updates, notified };
}

const event = (type: string, object: object): Stripe.Event =>
  ({ id: `evt_${type}`, type, data: { object } }) as unknown as Stripe.Event;

describe("plan selon le statut Stripe", () => {
  it("active, trialing et past_due restent pro ; le reste redescend en free", () => {
    expect(planForSubscriptionStatus("active")).toBe("pro");
    expect(planForSubscriptionStatus("trialing")).toBe("pro");
    expect(planForSubscriptionStatus("past_due")).toBe("pro");
    expect(planForSubscriptionStatus("canceled")).toBe("free");
    expect(planForSubscriptionStatus("unpaid")).toBe("free");
    expect(planForSubscriptionStatus("incomplete_expired")).toBe("free");
    expect(planForSubscriptionStatus(null)).toBe("free");
  });
});

describe("webhook Stripe", () => {
  it("checkout terminé → plan pro avec les identifiants Stripe", async () => {
    const { d, updates } = deps();
    await handleStripeEvent(
      event("checkout.session.completed", {
        mode: "subscription",
        client_reference_id: "org-1",
        customer: "cus_1",
        subscription: "sub_1",
      }),
      d,
    );
    expect(updates).toEqual([
      {
        organizationId: "org-1",
        plan: "pro",
        stripeCustomerId: "cus_1",
        stripeSubscriptionId: "sub_1",
      },
    ]);
  });

  it("annulation programmée : reste pro ; suppression : free", async () => {
    const { d, updates } = deps();
    await handleStripeEvent(
      event("customer.subscription.updated", {
        id: "sub_1",
        customer: "cus_1",
        status: "active",
        cancel_at_period_end: true,
        metadata: { organization_id: "org-1" },
      }),
      d,
    );
    await handleStripeEvent(
      event("customer.subscription.deleted", {
        id: "sub_1",
        customer: "cus_1",
        status: "canceled",
        metadata: {},
      }),
      d,
    );
    expect(updates.map((u) => u.plan)).toEqual(["pro", "free"]);
    expect(updates[1].stripeSubscriptionId).toBeNull();
  });

  it("réactivation après impayé : unpaid → free puis active → pro", async () => {
    const { d, updates } = deps();
    await handleStripeEvent(
      event("customer.subscription.updated", {
        id: "sub_1",
        customer: "cus_1",
        status: "unpaid",
        metadata: {},
      }),
      d,
    );
    await handleStripeEvent(
      event("customer.subscription.updated", {
        id: "sub_1",
        customer: "cus_1",
        status: "active",
        metadata: {},
      }),
      d,
    );
    expect(updates.map((u) => u.plan)).toEqual(["free", "pro"]);
  });

  it("paiement échoué : email aux propriétaires, plan inchangé", async () => {
    const { d, updates, notified } = deps();
    const spy = vi.fn();
    d.notifyPaymentFailed = async (id) => {
      spy(id);
      notified.push(id);
    };
    await handleStripeEvent(event("invoice.payment_failed", { customer: "cus_1" }), d);
    expect(updates).toEqual([]);
    expect(spy).toHaveBeenCalledWith("org-1");
  });

  it("client inconnu ou événement non géré : rien n'est appliqué", async () => {
    const { d, updates } = deps();
    expect(
      await handleStripeEvent(
        event("customer.subscription.updated", {
          id: "sub_x",
          customer: "cus_x",
          status: "active",
          metadata: {},
        }),
        d,
      ),
    ).toBe("organisation introuvable");
    expect(await handleStripeEvent(event("charge.succeeded", {}), d)).toBe("ignoré");
    expect(updates).toEqual([]);
  });
});
