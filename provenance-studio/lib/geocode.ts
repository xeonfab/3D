/**
 * Recherche de lieux (Mapbox Geocoding v6, résultats en français), côté
 * client avec le token public. Aucune coordonnée n'est inventée : chaque
 * résultat vient de Mapbox.
 */
import { publicEnv } from "@/lib/env";

export type GeocodeResult = {
  id: string;
  /** Nom court (ex. « Le Havre »). */
  name: string;
  /** Adresse complète, telle qu'affichée et enregistrée dans `place_name`. */
  placeName: string;
  lng: number;
  lat: number;
};

type MapboxFeature = {
  id: string;
  geometry: { coordinates: [number, number] };
  properties: { name?: string; full_address?: string; place_formatted?: string };
};

export async function geocode(query: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
  const token = publicEnv.NEXT_PUBLIC_MAPBOX_TOKEN;
  const q = query.trim();
  if (!token || q.length < 2) return [];

  const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  url.searchParams.set("q", q);
  url.searchParams.set("language", "fr");
  url.searchParams.set("limit", "5");
  url.searchParams.set("autocomplete", "true");
  url.searchParams.set("access_token", token);

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Geocoding : HTTP ${res.status}`);
  const json = (await res.json()) as { features?: MapboxFeature[] };

  return (json.features ?? []).map((f) => {
    const name = f.properties.name ?? f.properties.full_address ?? "";
    const placeName =
      f.properties.full_address ??
      [f.properties.name, f.properties.place_formatted].filter(Boolean).join(", ");
    return {
      id: f.id,
      name,
      placeName,
      lng: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
    };
  });
}
