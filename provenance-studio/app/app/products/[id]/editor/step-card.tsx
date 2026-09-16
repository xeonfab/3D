"use client";

import { useId, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  GripVertical,
  Loader2,
  Plane,
  RefreshCw,
  Ship,
  Trash2,
  TrainFront,
  TriangleAlert,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioSegment } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import type { GeocodeResult } from "@/lib/geocode";
import type { TransportMode } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

import { PhotoField } from "./photo-field";
import { PlaceSearch } from "./place-search";
import type { EditorStep } from "./types";

export type SeaRouteState = {
  status: "idle" | "computing" | "done" | "incomplete" | "error";
  message?: string;
};

type StepCardProps = {
  step: EditorStep;
  index: number;
  isLast: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photoUrl: string | null;
  seaRoute: SeaRouteState;
  onChange: (patch: Partial<Pick<EditorStep, "title" | "caption" | "mode">>) => void;
  onPlace: (result: GeocodeResult) => void;
  onClearPlace: () => void;
  onRecomputeSeaRoute: () => void;
  onUploadPhoto: (blob: Blob) => Promise<{ ok: true } | { ok: false; error: string }>;
  onRemovePhoto: () => Promise<{ ok: true } | { ok: false; error: string }>;
  onDelete: () => Promise<void>;
};

const MODES: {
  value: TransportMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "land", label: "Terre", icon: TrainFront },
  { value: "sea", label: "Mer", icon: Ship },
  { value: "air", label: "Air", icon: Plane },
];

export function StepCard({
  step,
  index,
  isLast,
  open,
  onOpenChange,
  photoUrl,
  seaRoute,
  onChange,
  onPlace,
  onClearPlace,
  onRecomputeSeaRoute,
  onUploadPhoto,
  onRemovePhoto,
  onDelete,
}: StepCardProps) {
  const ids = { title: useId(), caption: useId(), mode: useId() };
  const [deleting, setDeleting] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });
  const located = step.lat !== null && step.lng !== null;
  const summary = step.title || step.place_name || "Nouvelle étape";

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "rounded-xl border border-border bg-card transition-shadow",
        isDragging && "z-10 shadow-xl ring-1 ring-foreground/20",
      )}
    >
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <div className="flex items-center gap-2 p-3 pl-2">
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Réordonner l'étape ${index + 1} : ${summary}`}
            className="cursor-grab touch-none rounded-md p-1.5 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
          >
            <GripVertical className="size-4" aria-hidden="true" />
          </button>
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
              located
                ? "border-foreground/40"
                : "border-dashed border-muted-foreground text-muted-foreground",
            )}
            aria-hidden="true"
          >
            {index + 1}
          </span>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`${open ? "Replier" : "Déplier"} l'étape ${index + 1}`}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{summary}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {located ? step.place_name : "Lieu à choisir"}
                  {!isLast
                    ? ` · vers l'étape suivante : ${MODES.find((m) => m.value === step.mode)?.label.toLowerCase()}`
                    : " · dernière étape"}
                </span>
              </span>
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform",
                  open && "rotate-180",
                )}
              />
            </button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="flex flex-col gap-5 border-t border-border p-4">
            <PlaceSearch
              value={{ place_name: step.place_name, lat: step.lat, lng: step.lng }}
              onSelect={onPlace}
              onClear={onClearPlace}
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor={ids.title}>Titre</Label>
                <Input
                  id={ids.title}
                  value={step.title}
                  maxLength={60}
                  placeholder="Ferme Kayon Mountain"
                  onChange={(e) => onChange({ title: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <Label htmlFor={ids.caption}>Légende</Label>
                  <span
                    className={cn(
                      "text-xs tabular-nums",
                      step.caption.length >= 90 ? "text-destructive" : "text-muted-foreground",
                    )}
                    aria-live="polite"
                  >
                    {step.caption.length}/90
                  </span>
                </div>
                <Textarea
                  id={ids.caption}
                  value={step.caption}
                  maxLength={90}
                  rows={2}
                  placeholder="Récolte à la main, nov.–janv."
                  onChange={(e) => onChange({ caption: e.target.value.slice(0, 90) })}
                />
              </div>
            </div>

            {!isLast ? (
              <div className="flex flex-col gap-2">
                <Label id={ids.mode}>Transport vers l&apos;étape suivante</Label>
                <RadioGroup
                  aria-labelledby={ids.mode}
                  value={step.mode}
                  onValueChange={(v) => onChange({ mode: v as TransportMode })}
                  className="inline-flex w-fit gap-0 rounded-md border border-input p-0.5"
                >
                  {MODES.map(({ value, label, icon: Icon }) => (
                    <RadioSegment key={value} value={value} aria-label={label}>
                      <Icon className="size-4" aria-hidden="true" />
                      {label}
                    </RadioSegment>
                  ))}
                </RadioGroup>
                {step.mode === "sea" ? (
                  <div
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"
                    aria-live="polite"
                  >
                    {seaRoute.status === "computing" ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                        Calcul de la route maritime…
                      </span>
                    ) : seaRoute.status === "error" ? (
                      <span className="text-destructive">{seaRoute.message}</span>
                    ) : seaRoute.status === "incomplete" ? (
                      <span className="inline-flex items-center gap-1.5 text-amber-400">
                        <TriangleAlert className="size-3.5" aria-hidden="true" />
                        Route calculée, mais un passage n&apos;a pas pu être écarté des côtes :
                        corrigez-la sur la carte.
                      </span>
                    ) : located && step.waypoints.length > 0 ? (
                      <span>
                        Route maritime calculée ({step.waypoints.length} points). Déplacez les
                        points sur la carte pour la corriger.
                      </span>
                    ) : (
                      <span>La route sera calculée dès que les deux étapes sont localisées.</span>
                    )}
                    {located && seaRoute.status !== "computing" ? (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs"
                        onClick={onRecomputeSeaRoute}
                      >
                        <RefreshCw className="size-3" aria-hidden="true" />
                        Recalculer
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            <PhotoField photoUrl={photoUrl} onUpload={onUploadPhoto} onRemove={onRemovePhoto} />

            <div className="flex justify-end border-t border-border pt-4">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 aria-hidden="true" />
                    Supprimer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer cette étape ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      « {summary} » sera retirée du voyage, avec sa photo. Cette action est
                      définitive.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={deleting}
                      onClick={async (e) => {
                        e.preventDefault();
                        setDeleting(true);
                        await onDelete();
                        setDeleting(false);
                      }}
                    >
                      {deleting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                      Supprimer l&apos;étape
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}
