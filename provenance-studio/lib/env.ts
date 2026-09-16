import { z } from "zod";

/**
 * Variables d'environnement. Aucune valeur par défaut secrète : tout vient de
 * `.env.local` (voir `.env.example`). Les variables publiques sont inlinées par
 * Next.js et doivent être lues explicitement via `process.env.NEXT_PUBLIC_*`.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ message: "NEXT_PUBLIC_SUPABASE_URL doit être une URL" }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY manquante"),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_MAPBOX_TOKEN: z.string().optional(),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY manquante"),
});

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  NEXT_PUBLIC_MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_TOKEN || undefined,
});

let cachedServerEnv: z.infer<typeof serverSchema> | null = null;

/** À n'appeler que côté serveur : lève une erreur explicite si une clé manque. */
export function serverEnv() {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() ne doit jamais être appelé côté client.");
  }
  if (!cachedServerEnv) {
    cachedServerEnv = serverSchema.parse({
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
  }
  return cachedServerEnv;
}
