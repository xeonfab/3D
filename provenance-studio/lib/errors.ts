import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Traduit une erreur Postgres/PostgREST en message utilisateur en français.
 * Le détail technique est journalisé côté serveur, jamais affiché.
 */
export function userMessageFor(error: PostgrestError | Error | null | undefined): string {
  if (!error) return "Une erreur inattendue est survenue.";
  const message = error.message ?? "";
  if (message.includes("PLAN_LIMIT_PRODUCTS")) {
    return "Le plan gratuit permet un seul produit. Passez au plan Pro pour en créer d'autres.";
  }
  if (message.includes("PLAN_LIMIT_STEPS")) {
    return "Vous avez atteint le nombre maximal d'étapes pour votre plan.";
  }
  if ("code" in error && error.code === "23505") {
    return "Cette valeur est déjà utilisée. Choisissez-en une autre.";
  }
  if ("code" in error && error.code === "42501") {
    return "Vous n'avez pas les droits nécessaires pour cette action.";
  }
  return "Une erreur inattendue est survenue. Réessayez dans quelques instants.";
}
