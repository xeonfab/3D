"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireMembership } from "@/lib/auth";
import { cancelSubscriptionNow } from "@/lib/billing";
import { findUserIdByEmail } from "@/lib/members";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; success?: string };

const LOGO_TYPES: Record<string, string> = { "image/png": "png", "image/svg+xml": "svg" };

const brandSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Indiquez le nom de votre marque.")
    .max(80, "80 caractères maximum."),
  brand_color: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, "La couleur doit être un code hexadécimal, par exemple #D9822B."),
});

export async function updateBrandAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { membership } = await requireMembership();
  if (membership.role !== "owner")
    return { error: "Seul le propriétaire peut modifier la marque." };
  const org = membership.organization;
  const parsed = brandSchema.safeParse({
    name: formData.get("name"),
    brand_color: formData.get("brand_color"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  let logoPath = org.logo_path;
  const file = formData.get("logo");
  if (file instanceof File && file.size > 0) {
    const ext = LOGO_TYPES[file.type];
    if (!ext) return { error: "Le logo doit être un fichier PNG ou SVG." };
    if (file.size > 2 * 1024 * 1024) return { error: "Le logo ne doit pas dépasser 2 Mo." };
    const path = `${org.id}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("logos")
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
    if (error) {
      console.error("[settings] upload logo", error);
      return { error: "Le téléversement du logo a échoué." };
    }
    if (org.logo_path) await supabase.storage.from("logos").remove([org.logo_path]);
    logoPath = path;
  }

  const { error } = await supabase
    .from("organizations")
    .update({
      name: parsed.data.name,
      brand_color: parsed.data.brand_color.toUpperCase(),
      logo_path: logoPath,
    })
    .eq("id", org.id);
  if (error) {
    console.error("[settings] updateBrand", error);
    return { error: "Impossible d'enregistrer la marque pour le moment." };
  }
  return { success: "Marque enregistrée." };
}

const emailSchema = z.string().trim().toLowerCase().email("Adresse email invalide.");

export async function inviteMemberAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user, membership } = await requireMembership();
  if (membership.role !== "owner")
    return { error: "Seul le propriétaire peut inviter des membres." };
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const email = parsed.data;
  if (email === user.email?.toLowerCase())
    return { error: "Vous êtes déjà membre de cette marque." };

  const admin = createAdminClient();
  let userId = await findUserIdByEmail(email);
  if (!userId) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/auth/callback?next=/app`,
      data: { invited_to_organization: membership.organization.name },
    });
    if (error || !data.user) {
      console.error("[settings] invite", error);
      return { error: "L'invitation n'a pas pu être envoyée. Vérifiez l'adresse et réessayez." };
    }
    userId = data.user.id;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("organization_members")
    .insert({ organization_id: membership.organization.id, user_id: userId, role: "member" });
  if (error) {
    if (error.code === "23505") return { error: "Cette personne est déjà membre de la marque." };
    console.error("[settings] add member", error);
    return { error: "Impossible d'ajouter ce membre pour le moment." };
  }
  return { success: `Invitation envoyée à ${email}.` };
}

export async function removeMemberAction(memberId: string): Promise<FormState> {
  const { user, membership } = await requireMembership();
  if (!z.string().uuid().safeParse(memberId).success) return { error: "Membre introuvable." };
  const supabase = await createClient();
  const { data: target } = await supabase
    .from("organization_members")
    .select("id, user_id, role")
    .eq("id", memberId)
    .eq("organization_id", membership.organization.id)
    .maybeSingle();
  if (!target) return { error: "Membre introuvable." };
  if (target.user_id === user.id)
    return { error: "Pour quitter la marque, supprimez votre compte depuis cette page." };
  if (membership.role !== "owner") return { error: "Seul le propriétaire peut retirer un membre." };
  if (target.role === "owner") return { error: "Impossible de retirer un propriétaire." };
  const { error } = await supabase.from("organization_members").delete().eq("id", memberId);
  if (error) return { error: "Impossible de retirer ce membre pour le moment." };
  return { success: "Membre retiré." };
}

/**
 * Suppression du compte. Propriétaire unique : l'organisation entière est
 * supprimée (produits, étapes, rendus, fichiers, abonnement Stripe). Sinon,
 * seule l'adhésion et le compte utilisateur sont supprimés.
 */
export async function deleteAccountAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user, membership } = await requireMembership();
  if (
    String(formData.get("confirm") ?? "")
      .trim()
      .toUpperCase() !== "SUPPRIMER"
  ) {
    return { error: "Tapez SUPPRIMER pour confirmer." };
  }
  const admin = createAdminClient();
  const org = membership.organization;

  const { data: owners } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", org.id)
    .eq("role", "owner");
  const soleOwner = (owners ?? []).every((o) => o.user_id === user.id);

  try {
    if (soleOwner) {
      await cancelSubscriptionNow(org);
      for (const bucket of ["logos", "photos", "renders"] as const) {
        await removeStorageFolder(admin, bucket, org.id);
      }
      const { error } = await admin.from("organizations").delete().eq("id", org.id);
      if (error) throw error;
    } else {
      const { error } = await admin
        .from("organization_members")
        .delete()
        .eq("organization_id", org.id)
        .eq("user_id", user.id);
      if (error) throw error;
    }
    const { error: userError } = await admin.auth.admin.deleteUser(user.id);
    if (userError) throw userError;
  } catch (err) {
    console.error("[settings] deleteAccount", err);
    return { error: "La suppression a échoué. Contactez le support si le problème persiste." };
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login?deleted=1");
}

async function removeStorageFolder(
  admin: ReturnType<typeof createAdminClient>,
  bucket: string,
  prefix: string,
) {
  const paths: string[] = [];
  const walk = async (dir: string) => {
    const { data } = await admin.storage.from(bucket).list(dir, { limit: 1000 });
    for (const item of data ?? []) {
      const full = dir ? `${dir}/${item.name}` : item.name;
      if (item.id === null) await walk(full);
      else paths.push(full);
    }
  };
  await walk(prefix);
  if (paths.length) await admin.storage.from(bucket).remove(paths);
}
