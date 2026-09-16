import type { PlanType } from "@/lib/supabase/types";

/**
 * Limites de plan. Ces valeurs sont appliquées côté serveur (Server Actions)
 * ET en base (triggers `enforce_*_limit`). L'interface ne fait que les refléter.
 */
export type PlanLimits = {
  /** null = illimité */
  maxProducts: number | null;
  maxSteps: number;
  watermark: boolean;
  resolution: "720p" | "1080p";
  label: string;
  priceMonthlyEur: number;
};

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: {
    maxProducts: 1,
    maxSteps: 3,
    watermark: true,
    resolution: "720p",
    label: "Gratuit",
    priceMonthlyEur: 0,
  },
  pro: {
    maxProducts: null,
    maxSteps: 12,
    watermark: false,
    resolution: "1080p",
    label: "Pro",
    priceMonthlyEur: 79,
  },
};

export function limitsFor(plan: PlanType): PlanLimits {
  return PLAN_LIMITS[plan];
}
