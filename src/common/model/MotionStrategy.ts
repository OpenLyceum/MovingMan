/**
 * MotionStrategy.ts
 *
 * Which kinematic quantity is currently "driving" the man's motion. The other two
 * quantities are derived from the driving one (position → v,a by differentiation;
 * acceleration → v,x by integration; velocity → both).
 *
 * Implemented as a `const` object + string-literal union so the file stays
 * compatible with `erasableSyntaxOnly` (no TS-only enum runtime).
 */

export const MotionStrategy = {
  POSITION: "position",
  VELOCITY: "velocity",
  ACCELERATION: "acceleration",
} as const;

export type MotionStrategy = (typeof MotionStrategy)[keyof typeof MotionStrategy];
