import "server-only";

import { Resend } from "resend";

/**
 * Emails transactionnels (Resend). Sans RESEND_API_KEY, l'envoi est ignoré
 * et journalisé : jamais bloquant pour l'utilisateur.
 */
function client(): { resend: Resend; from: string } | null {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!key || !from) {
    console.warn("[email] RESEND_API_KEY ou RESEND_FROM_EMAIL manquant : email non envoyé.");
    return null;
  }
  return { resend: new Resend(key), from };
}

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function sendVideoReadyEmail(input: {
  to: string;
  productName: string;
  formatLabel: string;
  videoUrl: string;
  pageUrl: string;
  editorUrl: string;
}): Promise<void> {
  const c = client();
  if (!c) return;
  const subject = `Votre vidéo est prête : ${input.productName}`;
  const html = `
<div style="font-family:Inter,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1c1a17">
  <p style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#7a746c;margin:0 0 16px">Provenance Studio</p>
  <h1 style="font-family:Georgia,serif;font-weight:400;font-size:26px;margin:0 0 16px">Votre vidéo est prête.</h1>
  <p style="font-size:16px;line-height:1.5;margin:0 0 24px">
    La vidéo <strong>${escape(input.productName)}</strong> (${escape(input.formatLabel)}) a été générée.
    Vous pouvez la télécharger, la partager et imprimer son QR code.
  </p>
  <p style="margin:0 0 12px">
    <a href="${escape(input.videoUrl)}" style="display:inline-block;background:#1c1a17;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:15px">Télécharger la vidéo</a>
  </p>
  <p style="font-size:14px;line-height:1.6;color:#4a463f;margin:24px 0 0">
    Page publique : <a href="${escape(input.pageUrl)}" style="color:#1c1a17">${escape(input.pageUrl)}</a><br>
    Retrouver le produit dans l'éditeur : <a href="${escape(input.editorUrl)}" style="color:#1c1a17">${escape(input.editorUrl)}</a>
  </p>
  <p style="font-size:12px;color:#9a948b;margin:32px 0 0">Vous recevez cet email parce qu'une vidéo a été générée depuis votre compte Provenance Studio.</p>
</div>`;
  const text = `Votre vidéo « ${input.productName} » (${input.formatLabel}) est prête.\n\nTélécharger : ${input.videoUrl}\nPage publique : ${input.pageUrl}\nÉditeur : ${input.editorUrl}\n`;
  const { error } = await c.resend.emails.send({ from: c.from, to: input.to, subject, html, text });
  if (error) console.error("[email] sendVideoReadyEmail", error);
}

export async function sendPaymentFailedEmail(input: { to: string }): Promise<void> {
  const c = client();
  if (!c) return;
  const portal = `${(process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "")}/app/settings`;
  const html = `
<div style="font-family:Inter,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1c1a17">
  <p style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#7a746c;margin:0 0 16px">Provenance Studio</p>
  <h1 style="font-family:Georgia,serif;font-weight:400;font-size:26px;margin:0 0 16px">Le paiement de votre abonnement a échoué.</h1>
  <p style="font-size:16px;line-height:1.5;margin:0 0 24px">
    Votre plan Pro reste actif pendant que Stripe retente le prélèvement. Pour éviter une interruption,
    vérifiez votre moyen de paiement depuis vos paramètres.
  </p>
  <p style="margin:0"><a href="${escape(portal)}" style="display:inline-block;background:#1c1a17;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:15px">Mettre à jour le moyen de paiement</a></p>
</div>`;
  const { error } = await c.resend.emails.send({
    from: c.from,
    to: input.to,
    subject: "Paiement échoué : votre abonnement Pro",
    html,
    text: `Le paiement de votre abonnement Pro a échoué. Mettez à jour votre moyen de paiement : ${portal}`,
  });
  if (error) console.error("[email] sendPaymentFailedEmail", error);
}
