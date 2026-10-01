/**
 * MovingManConstants.ts
 *
 * Numeric physics and layout constants, ported from the original HTML5 Moving Man
 * (itself a port of the PhET "Moving Man" Java sim). Colors live in MovingManColors;
 * user-facing strings live in StringManager.
 */

import { Range } from "scenerystack/dot";
import MovingManNamespace from "./MovingManNamespace.js";

const MovingManConstants = {
  // The track runs from -HALF_CONTAINER_WIDTH to +HALF_CONTAINER_WIDTH meters.
  CONTAINER_WIDTH: 20,
  HALF_CONTAINER_WIDTH: 10,

  // Longest stretch of motion that the Charts screen records / plays back, in seconds.
  MAX_TIME: 20,

  // The model advances on a fixed internal timestep, matching the Java original's clock
  // of 24 fps (dt = 1/24 s ≈ 41.7 ms). Every derivative / integration step is calibrated
  // around this dt, so we substep instead of using the (variable) real frame dt.
  FIXED_DT: 1 / 24,
  MAX_CATCHUP_STEPS: 10,

  // ── Derivative / sampling tuning ─────────────────────────────────────────────
  // Number of recent mouse samples averaged to smooth pointer-driven position. Kept small
  // so the man tracks the pointer closely (no laggy "rubber-banding").
  NUMBER_MOUSE_POINTS_TO_AVERAGE: 4,
  // Half-window of the centered least-squares derivative. Widened from PhET's 1 to 3: a
  // 7-point regression rejects the high-frequency noise that double-differentiating a
  // hand-dragged position otherwise dumps into the acceleration, without faking the value
  // (it is still a real least-squares slope). The trade-off is lag: each readout is sampled
  // at its most-recent *fully centered* point — DERIVATIVE_RADIUS steps back for velocity,
  // twice that for acceleration — so acceleration lags by ~2*RADIUS*dt ≈ 250 ms. Lower it
  // for a snappier (but jitterier) acceleration; 1 restores exact PhET parity.
  DERIVATIVE_RADIUS: 3,
  // Fixed-size queues used to compute centered derivatives. Must hold at least 4*RADIUS+1
  // points so the acceleration sample (read 2*RADIUS steps back) still has a full symmetric
  // window on both sides.
  SERIES_SIZE_LIMIT: 13,
  // How many recent frame times the man remembers (for the centered-derivative lookup).
  // Must exceed 2*DERIVATIVE_RADIUS so the acceleration sample time can be looked up.
  NUM_TIME_POINTS_TO_RECORD: 12,

  // ── View arrow scaling (from PhET; tuned so the arrows read well on screen) ───
  VELOCITY_SCALE: 0.2,
  ACCELERATION_SCALE: 0.8,

  // ── Control ranges ───────────────────────────────────────────────────────────
  POSITION_RANGE: new Range(-10, 10),
  VELOCITY_RANGE: new Range(-16, 16),
  ACCELERATION_RANGE: new Range(-60, 60),

  // ── Chart zoom levels ────────────────────────────────────────────────────────
  // Each level is { max, step }: the axis extent and the tick/grid spacing at that
  // zoom. Index 0 is fully zoomed out and matches the control ranges above, so every
  // value a slider can set is visible on the chart.
  // The shared time (x) axis runs 0..max; the value (y) axes run -max..+max.
  TIME_ZOOM_LEVELS: [
    { max: 20, step: 5 },
    { max: 10, step: 2 },
    { max: 4, step: 1 },
  ],
  POSITION_ZOOM_LEVELS: [
    { max: 10, step: 5 },
    { max: 6, step: 3 },
    { max: 2, step: 1 },
  ],
  VELOCITY_ZOOM_LEVELS: [
    { max: 16, step: 8 },
    { max: 6, step: 3 },
    { max: 2, step: 1 },
  ],
  ACCELERATION_ZOOM_LEVELS: [
    { max: 60, step: 30 },
    { max: 30, step: 15 },
    { max: 10, step: 5 },
  ],
} as const;

MovingManNamespace.register("MovingManConstants", MovingManConstants);

export default MovingManConstants;

/** Corner radius shared by themed panels (px). */
export const PANEL_CORNER_RADIUS = 5;
