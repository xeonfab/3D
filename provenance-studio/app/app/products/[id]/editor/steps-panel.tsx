"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import type { EditorStep } from "./types";

type StepsPanelProps = {
  steps: EditorStep[];
  maxSteps: number;
  isFree: boolean;
  adding: boolean;
  onReorder: (orderedIds: string[]) => void;
  onAdd: () => void;
  children: React.ReactNode;
};

export function StepsPanel({
  steps,
  maxSteps,
  isFree,
  adding,
  onReorder,
  onAdd,
  children,
}: StepsPanelProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const limitReached = steps.length >= maxSteps;

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = steps.findIndex((s) => s.id === active.id);
    const to = steps.findIndex((s) => s.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(steps, from, to).map((s) => s.id));
  }

  const label = (id: string | number) => {
    const i = steps.findIndex((s) => s.id === id);
    const s = steps[i];
    return `étape ${i + 1}${s?.title ? ` (${s.title})` : ""}`;
  };

  return (
    <section aria-labelledby="steps-heading" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 id="steps-heading" className="font-serif text-xl">
          Les étapes du voyage
        </h2>
        <p className="text-xs text-muted-foreground tabular-nums">
          {steps.length}/{maxSteps}
        </p>
      </div>

      {steps.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
          Commencez par l&apos;origine : la ferme, le vignoble, l&apos;atelier de tissage…
        </p>
      ) : null}

      <DndContext
        id="steps-dnd"
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={onDragEnd}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              "Pour réordonner, appuyez sur Espace ou Entrée, déplacez avec les flèches haut et bas, puis validez avec Espace ou Entrée. Échap annule.",
          },
          announcements: {
            onDragStart: ({ active }) => `Déplacement de l'${label(active.id)}.`,
            onDragOver: ({ over }) =>
              over ? `Au-dessus de l'${label(over.id)}.` : "Hors de la liste.",
            onDragEnd: ({ active, over }) =>
              over
                ? `L'${label(active.id)} prend la place de l'${label(over.id)}.`
                : `Déplacement annulé.`,
            onDragCancel: ({ active }) => `Déplacement de l'${label(active.id)} annulé.`,
          },
        }}
      >
        <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ol className="flex flex-col gap-3">{children}</ol>
        </SortableContext>
      </DndContext>

      <div>
        {limitReached ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                tabIndex={0}
                className="inline-block rounded-md focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Button type="button" variant="outline" disabled aria-describedby="add-step-limit">
                  <Plus aria-hidden="true" />
                  Ajouter une étape
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent id="add-step-limit">
              {isFree
                ? "Le plan gratuit permet 3 étapes par produit. Passez au plan Pro pour aller jusqu'à 12."
                : "Un produit ne peut pas dépasser 12 étapes."}
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button type="button" variant="outline" onClick={onAdd} disabled={adding}>
            <Plus aria-hidden="true" />
            Ajouter une étape
          </Button>
        )}
      </div>
    </section>
  );
}
