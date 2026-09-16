/**
 * Test d'intégration RLS : un utilisateur de l'organisation A ne peut ni lire
 * ni écrire les données de l'organisation B.
 *
 * Nécessite un projet Supabase (local ou distant) avec les migrations
 * appliquées et ces variables dans `.env.test` ou `.env.local` :
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 * Sans elles, le test est ignoré (skip) et non échoué.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/lib/supabase/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anonKey && serviceKey);

type Client = SupabaseClient<Database>;

type TestUser = { id: string; email: string; client: Client };

const runId = Date.now().toString(36);

async function createTestUser(admin: Client, label: string): Promise<TestUser> {
  const email = `rls-${label}-${runId}@example.com`;
  const password = `Test-${runId}-${label}-password`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser a échoué");

  const client = createClient<Database>(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  return { id: data.user.id, email, client };
}

describe.skipIf(!enabled)("RLS : isolation entre organisations", () => {
  let admin: Client;
  let userA: TestUser;
  let userB: TestUser;
  let orgA: string;
  let orgB: string;
  let productA: string;
  let stepA: string;

  beforeAll(async () => {
    admin = createClient<Database>(url!, serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    userA = await createTestUser(admin, "a");
    userB = await createTestUser(admin, "b");

    // Chaque utilisateur crée son organisation (le trigger le rend owner).
    const { data: a, error: ea } = await userA.client
      .from("organizations")
      .insert({ name: "Org A", slug: `org-a-${runId}` })
      .select("id")
      .single();
    if (ea) throw ea;
    orgA = a.id;

    const { data: b, error: eb } = await userB.client
      .from("organizations")
      .insert({ name: "Org B", slug: `org-b-${runId}` })
      .select("id")
      .single();
    if (eb) throw eb;
    orgB = b.id;

    const { data: p, error: ep } = await userA.client
      .from("products")
      .insert({ organization_id: orgA, name: "Produit A", slug: "produit-a" })
      .select("id")
      .single();
    if (ep) throw ep;
    productA = p.id;

    const { data: s, error: es } = await userA.client
      .from("steps")
      .insert({ product_id: productA, position: 0, title: "Étape A" })
      .select("id")
      .single();
    if (es) throw es;
    stepA = s.id;
  });

  afterAll(async () => {
    if (!admin) return;
    if (orgA) await admin.from("organizations").delete().eq("id", orgA);
    if (orgB) await admin.from("organizations").delete().eq("id", orgB);
    if (userA) await admin.auth.admin.deleteUser(userA.id);
    if (userB) await admin.auth.admin.deleteUser(userB.id);
  });

  it("le créateur devient propriétaire de son organisation", async () => {
    const { data } = await userA.client
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgA);
    expect(data).toEqual([{ role: "owner" }]);
  });

  it("A voit ses propres données", async () => {
    const { data: orgs } = await userA.client.from("organizations").select("id");
    expect(orgs?.map((o) => o.id)).toEqual([orgA]);
    const { data: products } = await userA.client.from("products").select("id");
    expect(products?.map((p) => p.id)).toEqual([productA]);
  });

  it("B ne lit ni l'organisation, ni les produits, ni les étapes de A", async () => {
    const { data: orgs } = await userB.client.from("organizations").select("id").eq("id", orgA);
    expect(orgs).toEqual([]);

    const { data: members } = await userB.client
      .from("organization_members")
      .select("id")
      .eq("organization_id", orgA);
    expect(members).toEqual([]);

    const { data: products } = await userB.client.from("products").select("id").eq("id", productA);
    expect(products).toEqual([]);

    const { data: steps } = await userB.client.from("steps").select("id").eq("id", stepA);
    expect(steps).toEqual([]);
  });

  it("B ne peut pas modifier les données de A", async () => {
    const { data: updatedOrg } = await userB.client
      .from("organizations")
      .update({ name: "Piraté" })
      .eq("id", orgA)
      .select("id");
    expect(updatedOrg).toEqual([]);

    const { data: updatedProduct } = await userB.client
      .from("products")
      .update({ name: "Piraté" })
      .eq("id", productA)
      .select("id");
    expect(updatedProduct).toEqual([]);

    const { data: updatedStep } = await userB.client
      .from("steps")
      .update({ title: "Piraté" })
      .eq("id", stepA)
      .select("id");
    expect(updatedStep).toEqual([]);

    const { data: check } = await admin.from("products").select("name").eq("id", productA).single();
    expect(check?.name).toBe("Produit A");
  });

  it("B ne peut pas écrire dans l'organisation de A", async () => {
    const { error: productError } = await userB.client
      .from("products")
      .insert({ organization_id: orgA, name: "Intrus", slug: "intrus" });
    expect(productError).not.toBeNull();

    const { error: stepError } = await userB.client
      .from("steps")
      .insert({ product_id: productA, position: 1, title: "Intrus" });
    expect(stepError).not.toBeNull();

    const { error: memberError } = await userB.client
      .from("organization_members")
      .insert({ organization_id: orgA, user_id: userB.id, role: "owner" });
    expect(memberError).not.toBeNull();
  });

  it("B ne peut pas supprimer les données de A", async () => {
    const { data: deleted } = await userB.client
      .from("products")
      .delete()
      .eq("id", productA)
      .select("id");
    expect(deleted).toEqual([]);
    const { data: still } = await admin.from("products").select("id").eq("id", productA);
    expect(still).toHaveLength(1);
  });

  it("un utilisateur ne peut pas changer son propre plan", async () => {
    const { error } = await userA.client
      .from("organizations")
      .update({ plan: "pro" })
      .eq("id", orgA);
    expect(error).not.toBeNull();
    const { data } = await admin.from("organizations").select("plan").eq("id", orgA).single();
    expect(data?.plan).toBe("free");
  });

  it("les limites du plan gratuit sont appliquées en base", async () => {
    const { error: secondProduct } = await userA.client
      .from("products")
      .insert({ organization_id: orgA, name: "Produit 2", slug: "produit-2" });
    expect(secondProduct?.message).toContain("PLAN_LIMIT_PRODUCTS");

    await userA.client.from("steps").insert([
      { product_id: productA, position: 1 },
      { product_id: productA, position: 2 },
    ]);
    const { error: fourthStep } = await userA.client
      .from("steps")
      .insert({ product_id: productA, position: 3 });
    expect(fourthStep?.message).toContain("PLAN_LIMIT_STEPS");
  });
});
