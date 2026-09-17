import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { resolveCamera, resolveTiming, validateSteps } from "./data";
import { buildSceneContext, sceneAt, sceneStrings } from "./scene";
import { buildTimeline } from "./timeline";

const load = (file: string) =>
  validateSteps(JSON.parse(readFileSync(resolve("public", file), "utf8")));

const files = ["steps-origine.json", "steps-terroir.json"];
const viewports = [
  { width: 1080, height: 1920 },
  { width: 1920, height: 1080 },
];

for (const file of files) {
  describe(file, () => {
    const steps = load(file);
    const timing = resolveTiming(steps);
    const timeline = buildTimeline(steps, timing);

    it("les plans actor occupent au moins 70 % (actor + transit)", () => {
      assert.ok(
        timeline.actorRatio >= timing.minActorRatio,
        `ratio actor ${timeline.actorRatio.toFixed(2)} < ${timing.minActorRatio}`,
      );
    });

    it("dure entre 30 et 40 s", () => {
      const seconds = timeline.durationInFrames / timing.fps;
      assert.ok(seconds >= 30 && seconds <= 40, `durée ${seconds}s`);
    });

    it("commence par l'intro, finit par la fin, sans trou ni chevauchement", () => {
      const segs = timeline.segments;
      assert.equal(segs[0].kind, "intro");
      assert.equal(segs[segs.length - 1].kind, "ending");
      segs.forEach((s, i) => {
        if (i > 0) assert.equal(s.start, segs[i - 1].end);
        assert.ok(s.end > s.start);
      });
    });

    it("le premier actor n'a pas de vol d'entrée, les héros durent 8 s", () => {
      const actors = segs(timeline).filter((s) => s.kind === "actor");
      const first = actors[0];
      const last = actors[actors.length - 1];
      if (first.kind !== "actor" || last.kind !== "actor") throw new Error("actor attendu");
      if (steps.narrative === "origine") {
        assert.equal(first.flightEnd, first.start);
        assert.equal(first.end - first.start, timing.firstActorSeconds * timing.fps);
      }
      assert.equal(last.end - last.start, timing.lastActorSeconds * timing.fps);
    });

    it("aucun transit n'est fusionné en plus d'un vol de 3 s max", () => {
      for (const s of timeline.segments) {
        if (s.kind !== "transit") continue;
        assert.ok(s.end - s.start <= timing.transitMaxSeconds * timing.fps);
      }
    });

    for (const viewport of viewports) {
      it(`aucun nom de transit n'atteint les overlays (${viewport.width}×${viewport.height})`, () => {
        const ctx = buildSceneContext(steps, timing, resolveCamera(steps), viewport);
        const transitTitles = steps.steps.filter((s) => s.kind === "transit").map((s) => s.title);
        let sawFirstHero = false;
        let sawLastHero = false;
        for (let f = 0; f < timeline.durationInFrames; f++) {
          const state = sceneAt(ctx, f);
          const strings = sceneStrings(state);
          for (const t of transitTitles) {
            assert.ok(
              !strings.some((s) => s.includes(t)),
              `frame ${f} : « ${t} » (transit) est passé aux overlays`,
            );
          }
          assert.ok(
            !state.points.some((p) => steps.steps[p.step].kind === "transit"),
            `frame ${f} : point pulsant sur un transit`,
          );
          if (state.card?.large && state.card.personName === steps.steps[0].personName) sawFirstHero = true;
          if (state.card?.large && state.card.personName === steps.steps[steps.steps.length - 1].personName)
            sawLastHero = true;
        }
        if (steps.narrative === "origine") assert.ok(sawFirstHero, "premier héros jamais en grand");
        assert.ok(sawLastHero, "dernier héros jamais en grand");
      });
    }
  });
}

const segs = (t: ReturnType<typeof buildTimeline>) => t.segments;

describe("lieu et chapeaux", () => {
  it("traduit le pays et compose « Place, Pays »", () => {
    const steps = load("steps-origine.json");
    const timing = resolveTiming(steps);
    const ctx = buildSceneContext(steps, timing, resolveCamera(steps), { width: 1080, height: 1920 }, "fr");
    const first = buildTimeline(steps, timing).segments.find((s) => s.kind === "actor")!;
    const state = sceneAt(ctx, first.start + 20);
    assert.equal(state.card?.location, "Guji, Éthiopie");
    assert.equal(state.card?.chapter, "D'où ça vient");
  });
});

describe("validation", () => {
  it("refuse un step sans kind", () => {
    const raw = load("steps-origine.json");
    delete (raw.steps[1] as { kind?: string }).kind;
    assert.throws(() => validateSteps(raw), /kind/);
  });
  it("refuse un premier step transit", () => {
    const raw = load("steps-origine.json");
    raw.steps[0].kind = "transit";
    assert.throws(() => validateSteps(raw), /première étape/);
  });
  it("refuse un dernier step transit", () => {
    const raw = load("steps-origine.json");
    raw.steps[raw.steps.length - 1].kind = "transit";
    assert.throws(() => validateSteps(raw), /dernière étape/);
  });
  it("refuse un transit en mode terroir", () => {
    const raw = load("steps-terroir.json");
    raw.steps[1].kind = "transit";
    assert.throws(() => validateSteps(raw), /terroir/);
  });
});
