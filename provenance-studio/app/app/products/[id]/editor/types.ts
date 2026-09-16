import type { LngLat } from "@/lib/routes";
import type { ProductRow, StepRow } from "@/lib/supabase/types";

/** Étape telle que manipulée par l'éditeur : waypoints déjà typés. */
export type EditorStep = Omit<StepRow, "waypoints"> & { waypoints: LngLat[] };

export type EditorProduct = Pick<ProductRow, "id" | "name" | "end_line" | "status">;

export type Brand = {
  name: string;
  color: string;
  logoUrl: string | null;
};

export type VideoFormat = "vertical" | "horizontal";

export type SaveStatus = "saved" | "saving" | "error";
