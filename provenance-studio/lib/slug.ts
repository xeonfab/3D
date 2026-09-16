/**
 * Transforme un libellé en slug URL : minuscules, sans accents, tirets.
 * « Torréfaction Lucie » → « torrefaction-lucie ».
 */
export function slugify(input: string, maxLength = 60): string {
  const base = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[œŒ]/g, "oe")
    .replace(/[æÆ]/g, "ae")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  const cut = base.slice(0, maxLength).replace(/-+$/g, "");
  return cut;
}

/** Ajoute un suffixe court aléatoire pour garantir l'unicité. */
export function withRandomSuffix(slug: string, length = 4): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  let suffix = "";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (const b of bytes) suffix += alphabet[b % alphabet.length];
  return slug ? `${slug}-${suffix}` : suffix;
}
