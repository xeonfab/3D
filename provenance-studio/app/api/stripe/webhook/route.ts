import { NextResponse, type NextRequest } from "next/server";

import { handleStripeEvent, productionWebhookDeps } from "@/lib/billing";
import { sendPaymentFailedEmail } from "@/lib/email";
import { listOrganizationOwnersEmails } from "@/lib/members";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Webhook Stripe. Signature vérifiée, événement appliqué une seule fois
 * (table stripe_events), plan de l'organisation mis à jour.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature)
    return NextResponse.json({ error: "Webhook non configuré" }, { status: 400 });

  const payload = await request.text();
  let event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    console.error("[stripe] signature invalide", err);
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error: dedupeError } = await admin
    .from("stripe_events")
    .insert({ id: event.id, type: event.type });
  if (dedupeError) {
    if (dedupeError.code === "23505") return NextResponse.json({ received: true, duplicate: true });
    console.error("[stripe] stripe_events", dedupeError);
    return NextResponse.json({ error: "Base indisponible" }, { status: 500 });
  }

  try {
    const outcome = await handleStripeEvent(
      event,
      productionWebhookDeps(async (organizationId) => {
        const emails = await listOrganizationOwnersEmails(organizationId);
        await Promise.all(emails.map((to) => sendPaymentFailedEmail({ to })));
      }),
    );
    return NextResponse.json({ received: true, outcome });
  } catch (err) {
    console.error("[stripe] handleStripeEvent", event.type, err);
    // On retire le jeton pour que Stripe puisse rejouer l'événement.
    await admin.from("stripe_events").delete().eq("id", event.id);
    return NextResponse.json({ error: "Traitement échoué" }, { status: 500 });
  }
}
