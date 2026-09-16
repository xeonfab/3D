"use client";

import { useRef, useState } from "react";
import { Play, Square } from "lucide-react";

import { ProductMap, type MapStep, type ProductMapHandle } from "@/components/map/product-map";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioSegment } from "@/components/ui/radio-group";
import type { LngLat } from "@/lib/routes";
import { cn } from "@/lib/utils";

import type { Brand, VideoFormat } from "./types";

type MapPreviewProps = {
  steps: MapStep[];
  brand: Brand;
  selectedStepId: string | null;
  onWaypointsChange: (stepId: string, waypoints: LngLat[]) => void;
};

export function MapPreview({ steps, brand, selectedStepId, onWaypointsChange }: MapPreviewProps) {
  const mapRef = useRef<ProductMapHandle>(null);
  const [format, setFormat] = useState<VideoFormat>("vertical");
  const [playing, setPlaying] = useState(false);
  const locatedCount = steps.filter((s) => s.lat !== null).length;

  return (
    <section aria-labelledby="preview-heading" className="flex flex-col gap-4 lg:sticky lg:top-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="preview-heading" className="font-serif text-xl">
          Aperçu
        </h2>
        <div className="flex items-center gap-3">
          <RadioGroup
            aria-label="Format de la vidéo"
            value={format}
            onValueChange={(v) => setFormat(v as VideoFormat)}
            className="inline-flex gap-0 rounded-md border border-input p-0.5"
          >
            <RadioSegment value="vertical" className="min-w-0 px-2.5">
              9:16
            </RadioSegment>
            <RadioSegment value="horizontal" className="min-w-0 px-2.5">
              16:9
            </RadioSegment>
          </RadioGroup>
          {playing ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => mapRef.current?.stop()}
            >
              <Square aria-hidden="true" />
              Arrêter
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void mapRef.current?.play()}
              disabled={locatedCount === 0}
              title={
                locatedCount === 0 ? "Localisez au moins une étape pour lire l'aperçu." : undefined
              }
            >
              <Play aria-hidden="true" />
              Lire l&apos;aperçu
            </Button>
          )}
        </div>
      </div>

      <div className="flex justify-center">
        <div
          className={cn(
            "w-full overflow-hidden rounded-xl border border-border transition-[max-width] duration-300",
            format === "vertical"
              ? "aspect-[9/16] max-w-[min(100%,26rem)]"
              : "aspect-video max-w-full",
          )}
        >
          <ProductMap
            ref={mapRef}
            steps={steps}
            brandColor={brand.color}
            logoUrl={brand.logoUrl}
            brandName={brand.name}
            selectedStepId={selectedStepId}
            onWaypointsChange={onWaypointsChange}
            onPlayingChange={setPlaying}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        La carte se met à jour à chaque modification. « Lire l&apos;aperçu » enchaîne les vols de
        caméra sans rendre la vidéo.
      </p>
    </section>
  );
}
