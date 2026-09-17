import { z } from "zod";

import type { LngLat } from "@/lib/routes";

/** Props typées de la composition `ProvenanceVideo`. */
export const videoPropsSchema = z.object({
  product: z.object({
    name: z.string(),
    endLine: z.string(),
  }),
  steps: z
    .array(
      z.object({
        title: z.string(),
        caption: z.string(),
        lat: z.number(),
        lng: z.number(),
        mode: z.enum(["land", "sea", "air"]),
        waypoints: z.array(z.tuple([z.number(), z.number()])),
        /** URL absolue (Storage) ou chemin relatif dans `remotion/assets`. */
        photoUrl: z.string().nullable(),
        durationSeconds: z.number().int().min(2).max(20),
      }),
    )
    .min(1),
  brand: z.object({
    name: z.string(),
    /** #RRGGBB */
    color: z.string(),
    logoUrl: z.string().nullable(),
  }),
  watermark: z.boolean(),
  format: z.enum(["vertical", "horizontal"]),
  /** Token public Mapbox. `null` : carte de secours (continents SVG), pour les tests. */
  mapboxToken: z.string().nullable(),
});

export type VideoProps = z.infer<typeof videoPropsSchema>;
export type VideoStep = VideoProps["steps"][number];

export type Camera = { center: LngLat; zoom: number };
