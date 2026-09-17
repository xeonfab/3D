"use client";

import { useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

import { cn } from "@/lib/utils";

type PublicVideoProps = {
  src: string;
  poster: string | null;
  format: "vertical" | "horizontal";
  className?: string;
};

/** Lecteur : autoplay muet, boucle, bouton son. Aucune dépendance lourde. */
export function PublicVideo({ src, poster, format, className }: PublicVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  function toggle() {
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (v.paused) void v.play().catch(() => {});
  }

  return (
    <div className={cn("relative bg-black", className)}>
      <video
        ref={ref}
        src={src}
        poster={poster ?? undefined}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className={cn("h-full w-full", format === "vertical" ? "object-cover" : "object-contain")}
        aria-label="Vidéo du voyage du produit"
      />
      <button
        type="button"
        onClick={toggle}
        aria-pressed={!muted}
        aria-label={muted ? "Activer le son" : "Couper le son"}
        className="absolute right-4 bottom-4 flex size-11 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-white"
      >
        {muted ? (
          <VolumeX className="size-5" aria-hidden="true" />
        ) : (
          <Volume2 className="size-5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
