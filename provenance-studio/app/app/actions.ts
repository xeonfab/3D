"use server";

import { redirect } from "next/navigation";

import { requireMembership } from "@/lib/auth";
import { createProduct } from "@/lib/products";

export type NewProductState = { error?: string };

export async function createProductAction(
  _prev: NewProductState,
  formData: FormData,
): Promise<NewProductState> {
  const { membership } = await requireMembership();
  const result = await createProduct(membership.organization, String(formData.get("name") ?? ""));
  if (!result.ok) return { error: result.message };
  redirect(`/app/products/${result.product.id}`);
}
