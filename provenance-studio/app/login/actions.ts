"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";

const schema = z.object({
  email: z.string().trim().email("Adresse email invalide."),
  next: z.string().optional(),
});

export type MagicLinkState =
  { status: "idle" } | { status: "sent"; email: string } | { status: "error"; message: string };

/** Seuls les chemins internes sont acceptés comme destination après connexion. */
function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/app";
  return next;
}

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (host && process.env.NODE_ENV !== "production") return `${proto}://${host}`;
  return publicEnv.NEXT_PUBLIC_SITE_URL;
}

export async function sendMagicLink(
  _prev: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Adresse email invalide.",
    };
  }

  const supabase = await createClient();
  const origin = await siteOrigin();
  const redirectTo = new URL("/auth/callback", origin);
  redirectTo.searchParams.set("next", safeNext(parsed.data.next));

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: redirectTo.toString() },
  });

  if (error) {
    console.error("[auth] signInWithOtp", error);
    const message =
      error.status === 429
        ? "Trop de tentatives. Patientez une minute avant de réessayer."
        : "Impossible d'envoyer le lien pour le moment. Réessayez dans quelques instants.";
    return { status: "error", message };
  }

  return { status: "sent", email: parsed.data.email };
}
