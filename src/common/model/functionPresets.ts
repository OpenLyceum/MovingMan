/**
 * functionPresets.ts
 *
 * A menu of preset position-vs-time functions x(t). Selecting one drives the man's position
 * directly from the function; the walls still clamp the motion.
 *
 * Each preset also carries its exact first and second derivatives, v(t) = x'(t) and
 * a(t) = x''(t). Because the trajectory is known in closed form, the sim shows these exact
 * values instead of numerically differentiating the sampled position. That removes the readout
 * lag of the centered-derivative pipeline, so the x, v and a graphs line up instant for
 * instant (e.g. v crosses zero exactly where x peaks) and `t² − 8` reads a = 2 exactly.
 *
 * The original sim let the user type an arbitrary formula. SceneryStack has no native text
 * input, so we offer a curated set of representative functions instead — the common linear /
 * parabolic / sinusoidal / root cases from the original's help text, plus a few that target
 * classic graph-matching misconceptions (a turnaround with non-zero initial velocity, motion
 * that slows exponentially, a damped oscillation, and a piecewise cruise-brake-stop).
 */

export type MovingManFunctionPreset = {
  /** Fallback display label (the combo box shows the localized label from StringManager). */
  readonly labelString: string;
  /** Position in meters as a function of time in seconds. */
  readonly evaluate: (t: number) => number;
  /** Exact velocity dx/dt in m/s. */
  readonly velocity: (t: number) => number;
  /** Exact acceleration d²x/dt² in m/s². */
  readonly acceleration: (t: number) => number;
};

// Floor on t for the √t preset's derivatives, which diverge at t = 0.
const MIN_ROOT_TIME = 1e-6;

// Piecewise "cruise, brake, stop": 4 m/s from x = −8 for 2 s, then brake at −2 m/s² for 2 s
// (coming to rest at x = 4), then stand still.
const CRUISE_SPEED = 4;
const CRUISE_END = 2;
const BRAKE = -2;
const BRAKE_END = CRUISE_END - CRUISE_SPEED / BRAKE; // 4 s, when v reaches 0
const cruiseBrakeStop = (t: number): { x: number; v: number; a: number } => {
  if (t < CRUISE_END) {
    return { x: CRUISE_SPEED * t - 8, v: CRUISE_SPEED, a: 0 };
  }
  const xAtCruiseEnd = CRUISE_SPEED * CRUISE_END - 8;
  const tb = Math.min(t, BRAKE_END) - CRUISE_END;
  const x = xAtCruiseEnd + CRUISE_SPEED * tb + 0.5 * BRAKE * tb * tb;
  return t < BRAKE_END ? { x, v: CRUISE_SPEED + BRAKE * tb, a: BRAKE } : { x, v: 0, a: 0 };
};

export const FUNCTION_PRESETS: readonly MovingManFunctionPreset[] = [
  {
    labelString: "3·t − 5",
    evaluate: (t) => 3 * t - 5,
    velocity: () => 3,
    acceleration: () => 0,
  },
  {
    labelString: "t² − 8",
    evaluate: (t) => t * t - 8,
    velocity: (t) => 2 * t,
    acceleration: () => 2,
  },
  {
    labelString: "7·sin(t)",
    evaluate: (t) => 7 * Math.sin(t),
    velocity: (t) => 7 * Math.cos(t),
    acceleration: (t) => -7 * Math.sin(t),
  },
  {
    labelString: "7·cos(t)",
    evaluate: (t) => 7 * Math.cos(t),
    velocity: (t) => -7 * Math.sin(t),
    acceleration: (t) => -7 * Math.cos(t),
  },
  {
    labelString: "5·sin(2·t)",
    evaluate: (t) => 5 * Math.sin(2 * t),
    velocity: (t) => 10 * Math.cos(2 * t),
    acceleration: (t) => -20 * Math.sin(2 * t),
  },
  {
    // v = 10/√(20·t) diverges at t = 0. The model only samples derivatives after advancing the
    // clock (t ≥ 1/24 s), but t is floored anyway so a stray t = 0 stays finite.
    labelString: "√(20·t) − 10",
    evaluate: (t) => Math.sqrt(20 * t) - 10,
    velocity: (t) => 10 / Math.sqrt(20 * Math.max(t, MIN_ROOT_TIME)),
    acceleration: (t) => -100 / (20 * Math.max(t, MIN_ROOT_TIME)) ** 1.5,
  },
  {
    // Starts moving left with v₀ = −2 m/s, turns around at t = 2 s (x = −2 m), then speeds up
    // to the right: the classic "v = 0 does not mean a = 0" case.
    labelString: "−2·t + 0.5·t²",
    evaluate: (t) => -2 * t + 0.5 * t * t,
    velocity: (t) => -2 + t,
    acceleration: () => 1,
  },
  {
    // Approaches x = 8 m ever more slowly: v and a both decay exponentially, with a < 0 while
    // v > 0 (slowing down while still moving forward).
    labelString: "8 − 16·e^(−t/4)",
    evaluate: (t) => 8 - 16 * Math.exp(-t / 4),
    velocity: (t) => 4 * Math.exp(-t / 4),
    acceleration: (t) => -Math.exp(-t / 4),
  },
  {
    // A damped oscillation about x = 0.
    labelString: "8·e^(−t/5)·cos(2·t)",
    evaluate: (t) => 8 * Math.exp(-t / 5) * Math.cos(2 * t),
    velocity: (t) => 8 * Math.exp(-t / 5) * (-0.2 * Math.cos(2 * t) - 2 * Math.sin(2 * t)),
    acceleration: (t) => 8 * Math.exp(-t / 5) * (-3.96 * Math.cos(2 * t) + 0.8 * Math.sin(2 * t)),
  },
  {
    labelString: "Cruise, brake, stop",
    evaluate: (t) => cruiseBrakeStop(t).x,
    velocity: (t) => cruiseBrakeStop(t).v,
    acceleration: (t) => cruiseBrakeStop(t).a,
  },
];
