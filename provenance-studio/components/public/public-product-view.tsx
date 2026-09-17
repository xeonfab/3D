import { MapPin } from "lucide-react";

import { MapPlaceholder } from "@/components/map/map-placeholder";
import { PublicVideo } from "@/components/public/public-video";
import type { PublicPageData } from "@/lib/public-pages";

/**
 * Page publique (celle que scanne le consommateur) : vidéo verticale plein
 * écran sur mobile, puis la version lisible du voyage. Rendu serveur, un
 * seul composant client (le bouton son).
 */
export function PublicProductView({ data }: { data: PublicPageData }) {
  const { product, organization, steps, video } = data;
  const color = organization.brand_color;

  return (
    <main className="min-h-dvh bg-[#0c0d0f] text-white">
      <section className="relative mx-auto h-dvh w-full overflow-hidden bg-black md:h-auto md:max-w-md md:py-10">
        <div className="h-full w-full md:aspect-[9/16] md:h-auto md:overflow-hidden md:rounded-3xl md:border md:border-white/10 md:shadow-2xl">
          {video ? (
            <PublicVideo
              src={video.url}
              poster={video.thumbnailUrl}
              format={video.format}
              className="h-full w-full"
            />
          ) : (
            <div className="relative h-full w-full">
              <MapPlaceholder color={color} className="h-full w-full" />
              <p className="absolute inset-x-6 bottom-8 text-center text-sm text-white/80">
                La vidéo de ce produit arrive bientôt.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto w-full max-w-md px-6 pt-10 pb-16">
        <header className="flex flex-col items-center gap-4 text-center">
          {organization.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo du Storage (PNG ou SVG)
            <img
              src={organization.logoUrl}
              alt={organization.name}
              className="max-h-16 max-w-[60%] object-contain"
            />
          ) : (
            <p className="text-sm font-semibold tracking-[0.18em] uppercase text-white/80">
              {organization.name}
            </p>
          )}
          <h1 className="font-serif text-3xl leading-tight">{product.name}</h1>
          <p className="text-sm text-white/60">
            {steps.length > 1
              ? `${steps.length} étapes, de ${steps[0].place_name || steps[0].title} à ${steps[steps.length - 1].place_name || steps[steps.length - 1].title}`
              : "Son voyage, étape par étape"}
          </p>
        </header>

        <ol className="relative mt-12 flex flex-col gap-8 border-l border-white/10 pl-6">
          {steps.map((step, i) => (
            <li key={step.id} className="relative">
              <span
                aria-hidden="true"
                className="absolute top-1.5 -left-[31px] flex size-5 items-center justify-center rounded-full border-2 border-[#0c0d0f] text-[10px] font-semibold"
                style={{ backgroundColor: color, color: "#0c0d0f" }}
              >
                {i + 1}
              </span>
              <div className="flex gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold leading-snug">
                    {step.title || step.place_name}
                  </h2>
                  {step.place_name ? (
                    <p className="mt-0.5 flex items-center gap-1 text-sm text-white/60">
                      <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                      {step.place_name}
                    </p>
                  ) : null}
                  {step.caption ? (
                    <p className="mt-2 text-[15px] leading-relaxed text-white/85">{step.caption}</p>
                  ) : null}
                </div>
                {step.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- photo du Storage, déjà compressée
                  <img
                    src={step.photoUrl}
                    alt={step.title ? `Photo : ${step.title}` : ""}
                    loading="lazy"
                    width={96}
                    height={120}
                    className="aspect-[4/5] w-24 shrink-0 rounded-xl object-cover"
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ol>

        {product.end_line ? (
          <p className="mt-14 text-center font-serif text-xl leading-relaxed text-white/90">
            {product.end_line}
          </p>
        ) : null}

        {organization.plan === "free" ? (
          <p className="mt-12 text-center text-xs text-white/40">
            <a href="https://provenance.studio" className="underline-offset-4 hover:underline">
              Créé avec Provenance Studio
            </a>
          </p>
        ) : null}
      </section>
    </main>
  );
}
