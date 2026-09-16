"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, MapPin, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { geocode, type GeocodeResult } from "@/lib/geocode";
import { publicEnv } from "@/lib/env";
import { cn } from "@/lib/utils";

type PlaceSearchProps = {
  value: { place_name: string; lat: number | null; lng: number | null };
  onSelect: (result: GeocodeResult) => void;
  onClear: () => void;
};

/**
 * Recherche de lieu : combobox accessible (ARIA 1.2) sur l'API Mapbox
 * Geocoding v6, résultats en français. Aucune coordonnée n'est saisie à la
 * main : on choisit un résultat.
 */
export function PlaceSearch({ value, onSelect, onClear }: PlaceSearchProps) {
  const inputId = useId();
  const listId = useId();
  const [query, setQuery] = useState(value.place_name);
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const located = value.lat !== null && value.lng !== null;
  const hasToken = Boolean(publicEnv.NEXT_PUBLIC_MAPBOX_TOKEN);

  // Le lieu enregistré change (autre étape, annulation) → on aligne le champ.
  useEffect(() => {
    setQuery(value.place_name);
  }, [value.place_name]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2 || q === value.place_name) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const found = await geocode(q, controller.signal);
        if (!controller.signal.aborted) {
          setResults(found);
          setActive(found.length ? 0 : -1);
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          console.error(e);
          setError("La recherche de lieu est indisponible pour le moment.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query, open, value.place_name]);

  function choose(r: GeocodeResult) {
    onSelect(r);
    setQuery(r.placeName);
    setResults([]);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) {
      if (e.key === "ArrowDown") setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0) choose(results[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setQuery(value.place_name);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={inputId}>Lieu</Label>
      <div className="relative">
        <MapPin
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2",
            located ? "text-foreground" : "text-muted-foreground",
          )}
        />
        <Input
          id={inputId}
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
          aria-describedby={`${inputId}-hint`}
          autoComplete="off"
          placeholder={
            hasToken ? "Ville, port, adresse…" : "Recherche indisponible (token Mapbox manquant)"
          }
          disabled={!hasToken}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Laisse le temps au clic sur un résultat.
            setTimeout(() => {
              setOpen(false);
              setQuery(value.place_name);
            }, 150);
          }}
          onKeyDown={onKeyDown}
          className="pr-9 pl-9"
        />
        {loading ? (
          <Loader2
            aria-hidden="true"
            className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
          />
        ) : located ? (
          <button
            type="button"
            onClick={onClear}
            aria-label="Retirer le lieu"
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}

        {open && results.length > 0 ? (
          <ul
            id={listId}
            role="listbox"
            aria-label="Lieux proposés"
            className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-lg"
          >
            {results.map((r, i) => (
              <li
                key={r.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(r);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "cursor-pointer px-3 py-2 text-sm",
                  i === active ? "bg-accent text-accent-foreground" : "text-foreground",
                )}
              >
                <span className="block font-medium">{r.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{r.placeName}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">
        {error ??
          (located
            ? `${value.lat!.toFixed(4)}, ${value.lng!.toFixed(4)}`
            : "Choisissez un résultat : les coordonnées viennent du geocoder, jamais d'une saisie approximative.")}
      </p>
    </div>
  );
}
