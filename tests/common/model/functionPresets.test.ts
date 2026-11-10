import { describe, expect, it } from "vitest";
import { FUNCTION_PRESETS } from "../../../src/common/model/functionPresets.js";
import { StringManager } from "../../../src/i18n/StringManager.js";
import MovingManConstants from "../../../src/MovingManConstants.js";

const HALF_WIDTH: number = MovingManConstants.HALF_CONTAINER_WIDTH;
const MAX_TIME: number = MovingManConstants.MAX_TIME;

// Times at which the piecewise preset's acceleration jumps; numeric derivatives are skipped there.
const KINKS = [2, 4];

/**
 * When each preset first reaches a wall (|x| > 10 m) within the recordable 20 s, or null if it
 * stays on the track. Documents which presets are meant to hit a wall.
 */
const EXPECTED_WALL_HIT: Record<string, number | null> = {
  "3·t − 5": 5,
  "t² − 8": Math.sqrt(18),
  "7·sin(t)": null,
  "7·cos(t)": null,
  "5·sin(2·t)": null,
  "√(20·t) − 10": null, // reaches +10 m exactly at t = 20 s
  "−2·t + 0.5·t²": 2 + Math.sqrt(24),
  "8 − 16·e^(−t/4)": null,
  "8·e^(−t/5)·cos(2·t)": null,
  "Cruise, brake, stop": null,
};

describe("FUNCTION_PRESETS", () => {
  it("has a localized label for every preset", () => {
    expect(StringManager.getInstance().getPresetLabelProperties()).toHaveLength(FUNCTION_PRESETS.length);
  });

  it("documents when (if ever) each preset reaches a wall", () => {
    expect(Object.keys(EXPECTED_WALL_HIT)).toEqual(FUNCTION_PRESETS.map((p) => p.labelString));
    for (const preset of FUNCTION_PRESETS) {
      let hit: number | null = null;
      for (let t = 0; t <= MAX_TIME + 1e-9; t += 1e-3) {
        if (Math.abs(preset.evaluate(t)) > HALF_WIDTH + 1e-9) {
          hit = t;
          break;
        }
      }
      const expected = EXPECTED_WALL_HIT[preset.labelString];
      if (expected === null || expected === undefined) {
        expect(hit, preset.labelString).toBeNull();
      } else {
        expect(hit, preset.labelString).toBeCloseTo(expected, 2);
      }
    }
  });

  it("carries exact derivatives that match numerical differentiation of x(t)", () => {
    const h = 1e-4;
    for (const preset of FUNCTION_PRESETS) {
      for (let t = 0.1; t < MAX_TIME; t += 0.37) {
        if (KINKS.some((k) => Math.abs(t - k) < 2 * h)) {
          continue;
        }
        const v = (preset.evaluate(t + h) - preset.evaluate(t - h)) / (2 * h);
        const a = (preset.velocity(t + h) - preset.velocity(t - h)) / (2 * h);
        expect(preset.velocity(t), `${preset.labelString} v(${t})`).toBeCloseTo(v, 4);
        expect(preset.acceleration(t), `${preset.labelString} a(${t})`).toBeCloseTo(a, 3);
      }
    }
  });

  it("keeps every derivative finite, even at t = 0", () => {
    for (const preset of FUNCTION_PRESETS) {
      expect(Number.isFinite(preset.velocity(0)), preset.labelString).toBe(true);
      expect(Number.isFinite(preset.acceleration(0)), preset.labelString).toBe(true);
    }
  });

  it("cruise-brake-stop is continuous in x and v and comes to rest at x = 4 m", () => {
    const preset = FUNCTION_PRESETS.find((p) => p.labelString === "Cruise, brake, stop");
    expect(preset).toBeDefined();
    const eps = 1e-9;
    for (const k of KINKS) {
      expect(preset?.evaluate(k - eps)).toBeCloseTo(preset?.evaluate(k + eps) ?? Number.NaN, 6);
      expect(preset?.velocity(k - eps)).toBeCloseTo(preset?.velocity(k + eps) ?? Number.NaN, 6);
    }
    expect(preset?.evaluate(10)).toBe(4);
    expect(preset?.velocity(10)).toBe(0);
  });
});
