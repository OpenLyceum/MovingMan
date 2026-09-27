/**
 * functionPresets.ts
 *
 * A small menu of preset position-vs-time functions x(t). Selecting one drives the
 * man's position directly from the function (velocity and acceleration are then the
 * usual numerical derivatives); the walls still clamp the motion.
 *
 * The original sim let the user type an arbitrary formula. SceneryStack has no native
 * text input, so we offer a curated set of representative functions instead — the
 * common linear / parabolic / sinusoidal / root cases from the original's help text.
 * Amplitudes are kept within the position range so the man stays on screen.
 */

export type MovingManFunctionPreset = {
  /** Display label, e.g. "7·sin(t)". */
  readonly labelString: string;
  /** Position in meters as a function of time in seconds. */
  readonly evaluate: (t: number) => number;
};

export const FUNCTION_PRESETS: readonly MovingManFunctionPreset[] = [
  { labelString: "3·t − 5", evaluate: (t) => 3 * t - 5 },
  { labelString: "t² − 8", evaluate: (t) => t * t - 8 },
  { labelString: "7·sin(t)", evaluate: (t) => 7 * Math.sin(t) },
  { labelString: "7·cos(t)", evaluate: (t) => 7 * Math.cos(t) },
  { labelString: "5·sin(2·t)", evaluate: (t) => 5 * Math.sin(2 * t) },
  { labelString: "√(20·t) − 10", evaluate: (t) => Math.sqrt(20 * t) - 10 },
];
