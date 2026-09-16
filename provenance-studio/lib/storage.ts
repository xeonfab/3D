import { publicEnv } from "@/lib/env";

export type Bucket = "logos" | "photos" | "renders";

/** URL publique d'un objet Storage (les trois buckets sont publics en lecture). */
export function publicUrl(bucket: Bucket, path: string | null | undefined): string | null {
  if (!path) return null;
  const base = publicEnv.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${bucket}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}
