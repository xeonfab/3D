/**
 * Jeu de données de développement.
 *
 *   npm run seed
 *
 * Variables requises (dans .env.local) : NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY, SEED_OWNER_EMAIL (le compte qui possédera
 * l'organisation ; créé s'il n'existe pas, connexion ensuite par lien magique).
 *
 * Idempotent : relancer le script remet l'organisation et le produit à l'état
 * décrit ici.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

import type { Database, TablesInsert, TransportMode } from "../lib/supabase/types";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ownerEmail = process.env.SEED_OWNER_EMAIL;

if (!url || !serviceKey || !ownerEmail) {
  console.error(
    "Variables manquantes : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY et SEED_OWNER_EMAIL sont requises.",
  );
  process.exit(1);
}

const admin = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ORGANIZATION = {
  name: "Torréfaction Lucie",
  slug: "torrefaction-lucie",
  brand_color: "#D9822B",
  plan: "pro" as const,
};

const PRODUCT = {
  name: "Éthiopie Guji nature",
  slug: "ethiopie-guji-nature",
  end_line: "Récolté en janvier. Torréfié mardi dernier.",
};

type SeedStep = {
  title: string;
  place_name: string;
  lat: number;
  lng: number;
  caption: string;
  mode: TransportMode;
};

const STEPS: SeedStep[] = [
  {
    title: "Ferme Kayon Mountain",
    place_name: "Shakiso, Éthiopie",
    lat: 5.75,
    lng: 38.9,
    caption: "Récolte à la main, nov.–janv.",
    mode: "land",
  },
  {
    title: "Station de lavage",
    place_name: "Guji, Éthiopie",
    lat: 5.9,
    lng: 38.8,
    caption: "Séchage 18 jours sur lits africains",
    mode: "land",
  },
  {
    title: "Port de Djibouti",
    place_name: "Djibouti",
    lat: 11.6,
    lng: 43.15,
    caption: "Départ en conteneur, café vert en sacs GrainPro",
    mode: "sea",
  },
  {
    title: "Port du Havre",
    place_name: "Le Havre, France",
    lat: 49.49,
    lng: 0.11,
    caption: "6 semaines de traversée",
    mode: "land",
  },
  {
    title: "Entrepôt Belco",
    place_name: "Bordeaux, France",
    lat: 44.84,
    lng: -0.58,
    caption: "Stocké à température contrôlée",
    mode: "land",
  },
  {
    title: "Atelier",
    place_name: "Rennes, France",
    lat: 48.11,
    lng: -1.68,
    caption: "Torréfié en petit lot chaque semaine",
    mode: "land",
  },
];

async function findOrCreateOwner(email: string): Promise<string> {
  const { data: page, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const existing = page.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing) return existing.id;
  const { data, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (createError || !data.user) throw createError ?? new Error("createUser a échoué");
  console.log(`Utilisateur créé : ${email}`);
  return data.user.id;
}

async function upsertOrganization(ownerId: string): Promise<string> {
  const { data: existing } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", ORGANIZATION.slug)
    .maybeSingle();

  let orgId: string;
  if (existing) {
    const { error } = await admin.from("organizations").update(ORGANIZATION).eq("id", existing.id);
    if (error) throw error;
    orgId = existing.id;
  } else {
    const { data, error } = await admin
      .from("organizations")
      .insert(ORGANIZATION)
      .select("id")
      .single();
    if (error) throw error;
    orgId = data.id;
  }

  const { error: memberError } = await admin
    .from("organization_members")
    .upsert(
      { organization_id: orgId, user_id: ownerId, role: "owner" },
      { onConflict: "organization_id,user_id" },
    );
  if (memberError) throw memberError;

  const logo = readFileSync(path.join(__dirname, "..", "supabase", "seed", "logo.png"));
  const logoPath = `${orgId}/logo.png`;
  const { error: uploadError } = await admin.storage
    .from("logos")
    .upload(logoPath, logo, { contentType: "image/png", upsert: true });
  if (uploadError) throw uploadError;
  const { error: logoError } = await admin
    .from("organizations")
    .update({ logo_path: logoPath })
    .eq("id", orgId);
  if (logoError) throw logoError;

  return orgId;
}

async function resetProduct(orgId: string): Promise<string> {
  await admin.from("products").delete().eq("organization_id", orgId).eq("slug", PRODUCT.slug);

  const { data: product, error } = await admin
    .from("products")
    .insert({ organization_id: orgId, ...PRODUCT, status: "ready" })
    .select("id")
    .single();
  if (error) throw error;

  const rows: TablesInsert<"steps">[] = STEPS.map((s, position) => ({
    product_id: product.id,
    position,
    ...s,
    // Les waypoints maritimes (Djibouti → Le Havre) sont calculés par
    // l'éditeur (lib/routes.ts) à la première ouverture du produit.
    waypoints: [],
  }));
  const { error: stepsError } = await admin.from("steps").insert(rows);
  if (stepsError) throw stepsError;

  const { error: pageError } = await admin
    .from("public_pages")
    .insert({ product_id: product.id, slug: `${ORGANIZATION.slug}-${PRODUCT.slug}` });
  if (pageError) throw pageError;

  return product.id;
}

async function main() {
  const ownerId = await findOrCreateOwner(ownerEmail!);
  const orgId = await upsertOrganization(ownerId);
  const productId = await resetProduct(orgId);
  console.log(`Organisation « ${ORGANIZATION.name} » : ${orgId}`);
  console.log(`Produit « ${PRODUCT.name} » : ${productId} (${STEPS.length} étapes)`);
  console.log(`Ouvrez /app/products/${productId} après connexion avec ${ownerEmail}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
