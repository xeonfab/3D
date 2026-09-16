import Image from "next/image";
import Link from "next/link";

import { MapPlaceholder } from "@/components/map/map-placeholder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProductSummary } from "@/lib/products";
import { publicUrl } from "@/lib/storage";

const STATUS_LABEL = {
  draft: { label: "Brouillon", variant: "secondary" as const },
  ready: { label: "Prêt", variant: "success" as const },
};

export function ProductCard({
  product,
  brandColor,
}: {
  product: ProductSummary;
  brandColor: string;
}) {
  const thumbnail = publicUrl("renders", product.thumbnail_path);
  const status = STATUS_LABEL[product.status];
  const stepsLabel =
    product.steps_count === 0
      ? "Aucune étape"
      : product.steps_count === 1
        ? "1 étape"
        : `${product.steps_count} étapes`;

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-foreground/25">
      <div className="relative aspect-[16/10] w-full bg-[#111214]">
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt={`Miniature de la dernière vidéo de ${product.name}`}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          <MapPlaceholder color={brandColor} />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-medium">{product.name}</h2>
            <p className="text-sm text-muted-foreground">{stepsLabel}</p>
          </div>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <div className="mt-auto">
          <Button asChild variant="outline" className="w-full">
            <Link href={`/app/products/${product.id}`}>Ouvrir</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
