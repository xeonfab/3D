"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MonitorSmartphone } from "lucide-react";

import type { MapStep } from "@/components/map/product-map";
import type { RenderView } from "@/lib/render/service";
import type { GeocodeResult } from "@/lib/geocode";
import type { LngLat } from "@/lib/routes";
import { publicUrl } from "@/lib/storage";
import type { ProductStatus } from "@/lib/supabase/types";

import {
  addStep,
  computeSeaRouteAction,
  deleteStep,
  removeStepPhoto,
  reorderSteps,
  updateProduct,
  updateStep,
  uploadStepPhoto,
  type ProductPatch,
  type StepPatch,
} from "../actions";
import type { RenderOverview } from "../render-actions";
import { EditorHeader } from "./editor-header";
import { GenerateDialog } from "./generate-dialog";
import { MapPreview } from "./map-preview";
import { StepCard, type SeaRouteState } from "./step-card";
import { StepsPanel } from "./steps-panel";
import type { Brand, EditorProduct, EditorStep } from "./types";
import { useAutosave } from "./use-autosave";

type ProductEditorProps = {
  initialProduct: EditorProduct;
  initialSteps: EditorStep[];
  brand: Brand;
  plan: { maxSteps: number; isFree: boolean; resolution: string; watermark: boolean };
  initialRenders: RenderOverview;
};

type Patch = ({ kind: "product" } & ProductPatch) | ({ kind: "step" } & StepPatch);

const seaKey = (s: EditorStep, next: EditorStep | undefined) =>
  s.mode === "sea" && s.lat !== null && next && next.lat !== null
    ? `${s.lat},${s.lng}|${next.lat},${next.lng}`
    : null;

export function ProductEditor({
  initialProduct,
  initialSteps,
  brand,
  plan,
  initialRenders,
}: ProductEditorProps) {
  const [product, setProduct] = useState(initialProduct);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [rendering, setRendering] = useState(
    initialRenders.renders.some((r) => r.status === "queued" || r.status === "rendering"),
  );
  const [shareable, setShareable] = useState(
    Boolean(initialRenders.publicUrl) && initialRenders.renders.some((r) => r.status === "done"),
  );
  const onRendersChange = useCallback((renders: RenderView[]) => {
    setRendering(renders.some((r) => r.status === "queued" || r.status === "rendering"));
    if (renders.some((r) => r.status === "done")) setShareable(true);
  }, []);
  const [steps, setSteps] = useState(initialSteps);
  const [selectedId, setSelectedId] = useState<string | null>(initialSteps[0]?.id ?? null);
  const [adding, setAdding] = useState(false);
  const [seaRoutes, setSeaRoutes] = useState<Record<string, SeaRouteState>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const computedKeys = useRef(new Map<string, string>());
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  const applyStatus = useCallback((status?: ProductStatus) => {
    if (status) setProduct((p) => (p.status === status ? p : { ...p, status }));
  }, []);

  const autosave = useAutosave<Patch>(
    useCallback(
      async (key, patch) => {
        const { kind, ...rest } = patch;
        if (kind === "product") {
          const r = await updateProduct(product.id, rest as ProductPatch);
          return r.ok ? { ok: true } : { ok: false, error: r.error };
        }
        const r = await updateStep(product.id, key, rest as StepPatch);
        if (r.ok) applyStatus(r.status);
        return r.ok ? { ok: true } : { ok: false, error: r.error };
      },
      [product.id, applyStatus],
    ),
  );

  // --- produit ---------------------------------------------------------------
  const onProductChange = (patch: Partial<Pick<EditorProduct, "name" | "end_line">>) => {
    setProduct((p) => ({ ...p, ...patch }));
    autosave.queue("product", { kind: "product", ...patch });
  };

  // --- étapes ----------------------------------------------------------------
  const patchStep = useCallback(
    (id: string, patch: StepPatch) => {
      setSteps((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
      autosave.queue(id, { kind: "step", ...patch });
    },
    [autosave],
  );

  const onPlace = (id: string, r: GeocodeResult) =>
    patchStep(id, { place_name: r.placeName, lat: r.lat, lng: r.lng });

  const onClearPlace = (id: string) =>
    patchStep(id, { place_name: "", lat: null, lng: null, waypoints: [] });

  const onWaypointsChange = useCallback(
    (id: string, waypoints: LngLat[]) => patchStep(id, { waypoints }),
    [patchStep],
  );

  const onAdd = async () => {
    setAdding(true);
    setActionError(null);
    const r = await addStep(product.id);
    setAdding(false);
    if (!r.ok) {
      setActionError(r.error);
      return;
    }
    const step: EditorStep = { ...r.data, waypoints: [] };
    setSteps((list) => [...list, step]);
    setSelectedId(step.id);
    applyStatus(r.status);
  };

  const onDelete = async (id: string) => {
    setActionError(null);
    autosave.discard(id);
    const r = await deleteStep(product.id, id);
    if (!r.ok) {
      setActionError(r.error);
      return;
    }
    setSteps((list) => list.filter((s) => s.id !== id).map((s, i) => ({ ...s, position: i })));
    setSelectedId((sel) => (sel === id ? null : sel));
    applyStatus(r.status);
  };

  const onReorder = async (orderedIds: string[]) => {
    const previous = stepsRef.current;
    setSteps((list) =>
      orderedIds.map((id, i) => ({ ...list.find((s) => s.id === id)!, position: i })),
    );
    const r = await reorderSteps(product.id, orderedIds);
    if (!r.ok) {
      setActionError(r.error);
      setSteps(previous);
    }
  };

  const onUploadPhoto = async (id: string, blob: Blob) => {
    const fd = new FormData();
    fd.append("photo", blob, "photo.jpg");
    const r = await uploadStepPhoto(product.id, id, fd);
    if (r.ok)
      setSteps((list) =>
        list.map((s) => (s.id === id ? { ...s, photo_path: r.data.photo_path } : s)),
      );
    return r.ok ? { ok: true as const } : { ok: false as const, error: r.error };
  };

  const onRemovePhoto = async (id: string) => {
    const r = await removeStepPhoto(product.id, id);
    if (r.ok) setSteps((list) => list.map((s) => (s.id === id ? { ...s, photo_path: null } : s)));
    return r.ok ? { ok: true as const } : { ok: false as const, error: r.error };
  };

  // --- routes maritimes ------------------------------------------------------
  const computeSea = useCallback(
    async (id: string, force = false) => {
      const list = stepsRef.current;
      const i = list.findIndex((s) => s.id === id);
      const step = list[i];
      const next = list[i + 1];
      const key = step ? seaKey(step, next) : null;
      if (!step || !key) return;
      if (!force && computedKeys.current.get(id) === key) return;
      computedKeys.current.set(id, key);
      setSeaRoutes((m) => ({ ...m, [id]: { status: "computing" } }));
      const r = await computeSeaRouteAction([step.lng!, step.lat!], [next!.lng!, next!.lat!]);
      // Les extrémités ont changé entre-temps : ce résultat est obsolète.
      const now = stepsRef.current.find((s) => s.id === id);
      const nowNext = stepsRef.current[stepsRef.current.findIndex((s) => s.id === id) + 1];
      if (!now || seaKey(now, nowNext) !== key) return;
      if (!r.ok) {
        computedKeys.current.delete(id);
        setSeaRoutes((m) => ({ ...m, [id]: { status: "error", message: r.error } }));
        return;
      }
      patchStep(id, { waypoints: r.data.waypoints });
      setSeaRoutes((m) => ({ ...m, [id]: { status: r.data.incomplete ? "incomplete" : "done" } }));
    },
    [patchStep],
  );

  useEffect(() => {
    steps.forEach((s, i) => {
      const key = seaKey(s, steps[i + 1]);
      if (!key) {
        computedKeys.current.delete(s.id);
        return;
      }
      // Waypoints déjà en base (rechargement) : on considère la route à jour.
      if (s.waypoints.length > 0 && !computedKeys.current.has(s.id)) {
        computedKeys.current.set(s.id, key);
        return;
      }
      if (computedKeys.current.get(s.id) !== key) void computeSea(s.id);
    });
  }, [steps, computeSea]);

  // --- dérivés ---------------------------------------------------------------
  const mapSteps = useMemo<MapStep[]>(
    () =>
      steps.map((s) => ({
        id: s.id,
        title: s.title,
        caption: s.caption,
        place_name: s.place_name,
        lat: s.lat,
        lng: s.lng,
        mode: s.mode,
        waypoints: s.waypoints,
        photoUrl: publicUrl("photos", s.photo_path),
      })),
    [steps],
  );

  const readyForVideo = product.status === "ready";

  return (
    <div className="flex flex-col gap-8">
      <p className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground md:hidden">
        <MonitorSmartphone className="size-4 shrink-0" aria-hidden="true" />
        Un écran d&apos;ordinateur est recommandé pour éditer. Vous pouvez consulter et retoucher
        ici.
      </p>

      <EditorHeader
        product={product}
        saveStatus={autosave.status}
        saveError={autosave.error}
        onChange={onProductChange}
        onGenerate={() => setGenerateOpen(true)}
        generating={rendering}
        onShare={shareable ? () => setGenerateOpen(true) : undefined}
        generateDisabledReason={
          readyForVideo ? undefined : "Localisez au moins deux étapes pour générer la vidéo."
        }
      />

      <GenerateDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        productId={product.id}
        initial={initialRenders}
        plan={{ isFree: plan.isFree, resolution: plan.resolution, watermark: plan.watermark }}
        onRendersChange={onRendersChange}
      />

      {actionError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {actionError}
        </p>
      ) : null}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <StepsPanel
          steps={steps}
          maxSteps={plan.maxSteps}
          isFree={plan.isFree}
          adding={adding}
          onReorder={onReorder}
          onAdd={onAdd}
        >
          {steps.map((step, i) => (
            <StepCard
              key={step.id}
              step={step}
              index={i}
              isLast={i === steps.length - 1}
              open={selectedId === step.id}
              onOpenChange={(open) => setSelectedId(open ? step.id : null)}
              photoUrl={publicUrl("photos", step.photo_path)}
              seaRoute={seaRoutes[step.id] ?? { status: "idle" }}
              onChange={(patch) => patchStep(step.id, patch)}
              onPlace={(r) => onPlace(step.id, r)}
              onClearPlace={() => onClearPlace(step.id)}
              onRecomputeSeaRoute={() => void computeSea(step.id, true)}
              onUploadPhoto={(blob) => onUploadPhoto(step.id, blob)}
              onRemovePhoto={() => onRemovePhoto(step.id)}
              onDelete={() => onDelete(step.id)}
            />
          ))}
        </StepsPanel>

        <MapPreview
          steps={mapSteps}
          brand={brand}
          selectedStepId={selectedId}
          onWaypointsChange={onWaypointsChange}
        />
      </div>
    </div>
  );
}
