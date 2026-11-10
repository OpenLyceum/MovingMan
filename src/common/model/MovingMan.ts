/**
 * MovingMan.ts
 *
 * The man who moves along the 1-D track. He keeps position, velocity and acceleration
 * and updates them from the currently driving quantity (the MotionStrategy):
 *   - POSITION-driven: pointer/slider sets position; v and a are differentiated.
 *   - VELOCITY-driven: slider sets velocity; position is integrated, a differentiated.
 *   - ACCELERATION-driven: slider sets acceleration; v and position are integrated.
 *
 * Ported faithfully from the original moving-man.js. Backbone attributes become axon
 * Properties and the model's `trigger('collide')` becomes the collideEmitter.
 */

import { Emitter, NumberProperty, Property } from "scenerystack/axon";
import { metersPerSecondSquaredUnit, metersPerSecondUnit, metersUnit } from "scenerystack/scenery-phet";
import MovingManConstants from "../../MovingManConstants.js";
import { type DataPoint, type DataSeries, LimitedSizeDataSeries, LimitedTimeDataSeries } from "./DataSeries.js";
import type { MovingManFunctionPreset } from "./functionPresets.js";
import { MotionStrategy } from "./MotionStrategy.js";
import { estimateDerivative } from "./motionMath.js";

const {
  NUMBER_MOUSE_POINTS_TO_AVERAGE,
  DERIVATIVE_RADIUS,
  FIXED_DT,
  MAX_TIME,
  SERIES_SIZE_LIMIT,
  NUM_TIME_POINTS_TO_RECORD,
} = MovingManConstants;

/** Below this magnitude the differentiated value wiggles around ±1e-12, so snap to 0. */
const ZERO_THRESHOLD = 1e-6;

/** What the man needs to know about the surrounding simulation. */
export interface ManContext {
  readonly wallsEnabled: boolean;
  /** When true, a slider-driven man bounces off a wall (v → −v) instead of stopping dead. */
  readonly elasticWalls: boolean;
  readonly halfContainerWidth: number;
  isPaused(): boolean;
}

type WallResult = { position: number; collided: boolean };
type WallBounce = { position: number; velocity: number };

/** Snapshot of the man's instantaneous state, stored for playback. */
export type ManState = {
  position: number;
  velocity: number;
  acceleration: number;
  motionStrategy: MotionStrategy;
};

export class MovingMan {
  public readonly positionProperty = new NumberProperty(0, { units: metersUnit });
  public readonly velocityProperty = new NumberProperty(0, { units: metersPerSecondUnit });
  public readonly accelerationProperty = new NumberProperty(0, { units: metersPerSecondSquaredUnit });
  public readonly motionStrategyProperty = new Property<MotionStrategy>(MotionStrategy.POSITION);

  // When non-null, the man's position is driven by this preset function of time x(t),
  // overriding the motion strategy. Interacting with the man (drag/slider) clears it.
  public readonly functionProperty = new Property<MovingManFunctionPreset | null>(null);

  public readonly collideEmitter = new Emitter();
  public readonly historyClearedEmitter = new Emitter();

  // Rolling windows used to estimate centered derivatives.
  private readonly mouseDataSeries = new LimitedSizeDataSeries(SERIES_SIZE_LIMIT);
  private readonly positionModelSeries = new LimitedSizeDataSeries(SERIES_SIZE_LIMIT);
  private readonly velocityModelSeries = new LimitedSizeDataSeries(SERIES_SIZE_LIMIT);
  private readonly accelerationModelSeries = new LimitedSizeDataSeries(SERIES_SIZE_LIMIT);

  // The series displayed on the Charts screen.
  public readonly positionGraphSeries: DataSeries;
  public readonly velocityGraphSeries: DataSeries;
  public readonly accelerationGraphSeries: DataSeries;

  private readonly context: ManContext;
  private time = 0;
  private times: number[] = [];
  private mousePosition = 0;

  public constructor(context: ManContext, noRecording: boolean) {
    this.context = context;

    if (noRecording) {
      this.positionGraphSeries = new LimitedSizeDataSeries(SERIES_SIZE_LIMIT);
      this.velocityGraphSeries = new LimitedSizeDataSeries(SERIES_SIZE_LIMIT);
      this.accelerationGraphSeries = new LimitedSizeDataSeries(SERIES_SIZE_LIMIT);
    } else {
      // The graph series only retain points up to the recording limit.
      this.positionGraphSeries = new LimitedTimeDataSeries(MAX_TIME);
      this.velocityGraphSeries = new LimitedTimeDataSeries(MAX_TIME);
      this.accelerationGraphSeries = new LimitedTimeDataSeries(MAX_TIME);
    }
  }

  // ── Motion-strategy helpers ───────────────────────────────────────────────────

  public get positionDriven(): boolean {
    return this.motionStrategyProperty.value === MotionStrategy.POSITION;
  }

  public get velocityDriven(): boolean {
    return this.motionStrategyProperty.value === MotionStrategy.VELOCITY;
  }

  public get accelerationDriven(): boolean {
    return this.motionStrategyProperty.value === MotionStrategy.ACCELERATION;
  }

  public setPositionDriven(): void {
    this.functionProperty.value = null;
    this.motionStrategyProperty.value = MotionStrategy.POSITION;
  }

  public setVelocityDriven(): void {
    this.functionProperty.value = null;
    this.motionStrategyProperty.value = MotionStrategy.VELOCITY;
  }

  public setAccelerationDriven(): void {
    this.functionProperty.value = null;
    this.motionStrategyProperty.value = MotionStrategy.ACCELERATION;
  }

  // ── History management ────────────────────────────────────────────────────────

  /**
   * Wipe all history and the rolling derivative windows, restarting the pipeline at the man's
   * current position (time = 0). Fires historyClearedEmitter so the charts drop stale graph data.
   */
  public clear(): void {
    this.time = 0;
    this.times.length = 0;
    this.setMousePosition(this.positionProperty.value);

    this.mouseDataSeries.clear();
    this.positionModelSeries.clear();
    this.velocityModelSeries.clear();
    this.accelerationModelSeries.clear();
    this.positionGraphSeries.clear();
    this.velocityGraphSeries.clear();
    this.accelerationGraphSeries.clear();

    this.historyClearedEmitter.emit();
  }

  /**
   * Drop every recorded and rolling-window sample at or after `time` (used when the user begins
   * recording over an existing run). Fires historyClearedEmitter so the charts re-read the
   * truncated series.
   *
   * @param time - model time (seconds); samples with time >= this are discarded.
   */
  public clearHistoryAfter(time: number): void {
    this.times.length = 0;

    this.mouseDataSeries.clearPointsAfter(time);
    this.positionModelSeries.clearPointsAfter(time);
    this.velocityModelSeries.clearPointsAfter(time);
    this.accelerationModelSeries.clearPointsAfter(time);
    this.positionGraphSeries.clearPointsAfter(time);
    this.velocityGraphSeries.clearPointsAfter(time);
    this.accelerationGraphSeries.clearPointsAfter(time);

    this.historyClearedEmitter.emit();
  }

  /** Snapshot the man's instantaneous kinematic state (position/velocity/acceleration/strategy)
   * for the playback history. Returns a fresh plain object the caller owns. */
  public getState(): ManState {
    return {
      position: this.positionProperty.value,
      velocity: this.velocityProperty.value,
      acceleration: this.accelerationProperty.value,
      motionStrategy: this.motionStrategyProperty.value,
    };
  }

  /**
   * Restore a previously recorded state while scrubbing or playing back. Sets the
   * position/velocity/acceleration/strategy Properties and the time bookkeeping to `time`; the
   * rolling derivative windows are intentionally left untouched because playback reads recorded
   * values rather than re-differentiating.
   *
   * @param time - model time (seconds) this state belongs to.
   * @param state - the snapshot produced by getState().
   */
  public applyState(time: number, state: ManState): void {
    this.time = time;
    this.times = [];
    this.positionProperty.value = state.position;
    this.velocityProperty.value = state.velocity;
    this.accelerationProperty.value = state.acceleration;
    this.motionStrategyProperty.value = state.motionStrategy;
    this.setMousePosition(state.position);
  }

  // ── Stepping ──────────────────────────────────────────────────────────────────

  public update(time: number, delta: number): void {
    this.time = time;

    this.times.push(this.time);
    if (this.times.length > NUM_TIME_POINTS_TO_RECORD) {
      this.times.shift();
    }

    this.dispatchUpdate(time, delta);
  }

  /**
   * Run a single step against whichever driver is active, WITHOUT recording the frame time.
   * Split out from update() so time is pushed to `times` exactly once per step,
   * keeping the centered-derivative lookups (getTimeNTimeStepsAgo) accurate.
   */
  private dispatchUpdate(time: number, delta: number): void {
    const preset = this.functionProperty.value;
    if (preset) {
      this.updateFromFunction(time, preset);
    } else if (this.positionDriven) {
      this.updateFromPosition(time);
    } else if (this.velocityDriven) {
      this.updateFromVelocity(time, delta);
    } else if (this.accelerationDriven) {
      this.updateFromAcceleration(time, delta);
    }
  }

  /**
   * Drive position directly from a preset x(t). The preset knows its exact derivatives, so v and
   * a are evaluated in closed form at the same instant as x — no numerical lag, so the three
   * graphs line up exactly. While the man is pinned against a wall he is at rest (v = a = 0).
   */
  private updateFromFunction(time: number, preset: MovingManFunctionPreset): void {
    const previousPosition = this.positionProperty.value;

    const wallResult = this.clampIfWalled(preset.evaluate(time));
    const position = wallResult.position;
    const velocity = wallResult.collided ? 0 : preset.velocity(time);
    const acceleration = wallResult.collided ? 0 : preset.acceleration(time);

    // Keep the rolling windows fed, so dragging the man away from a running preset (or switching
    // to a slider) hands control back smoothly (matches the original's expression branch).
    this.mouseDataSeries.add(position, time);
    this.positionModelSeries.add(position, time);
    this.velocityModelSeries.add(velocity, time);
    this.accelerationModelSeries.add(acceleration, time);

    this.positionGraphSeries.add(position, time);
    this.addGraphPoint(this.velocityGraphSeries, { value: velocity, time });
    this.addGraphPoint(this.accelerationGraphSeries, { value: acceleration, time });

    this.positionProperty.value = position;
    this.velocityProperty.value = this.snapToZero(velocity);
    this.accelerationProperty.value = this.snapToZero(acceleration);

    this.setMousePosition(position);

    if (!this.hitsWall(previousPosition) && this.hitsWall(position)) {
      this.collideEmitter.emit();
    }
  }

  private updateFromPosition(time: number): void {
    const previousPosition = this.positionProperty.value;

    this.mouseDataSeries.add(this.clampIfWalled(this.mousePosition).position, time);

    // Average of the latest pointer samples.
    const positions = this.mouseDataSeries.getPointsInRange(
      this.mouseDataSeries.size() - NUMBER_MOUSE_POINTS_TO_AVERAGE,
      this.mouseDataSeries.size(),
    );
    let sum = 0;
    for (const point of positions) {
      sum += point.value;
    }
    const x = positions.length > 0 ? sum / positions.length : 0;
    const position = this.clampIfWalled(x).position;
    this.positionModelSeries.add(position, time);
    this.positionGraphSeries.add(position, time);

    // Differentiate position → velocity → acceleration.
    this.velocityModelSeries.setData(this.estimatedCenteredDerivatives(this.positionModelSeries));
    this.accelerationModelSeries.setData(this.estimatedCenteredDerivatives(this.velocityModelSeries));

    // Read each derivative at its most-recent *fully centered* sample, where the least-squares
    // window is symmetric (and so smoothest / least jittery): velocity DERIVATIVE_RADIUS steps
    // back, acceleration twice that. Each graph point keeps that sample's own time, so the v and
    // a graphs stay aligned with x (their lines just end a little before the cursor).
    const velocity = this.addDerivativeSample(this.velocityGraphSeries, this.velocityModelSeries, DERIVATIVE_RADIUS);
    const acceleration = this.addDerivativeSample(
      this.accelerationGraphSeries,
      this.accelerationModelSeries,
      2 * DERIVATIVE_RADIUS,
    );

    this.positionProperty.value = position;
    this.velocityProperty.value = this.snapToZero(velocity);
    this.accelerationProperty.value = this.snapToZero(acceleration);

    if (!this.hitsWall(previousPosition) && this.hitsWall(this.positionProperty.value)) {
      this.collideEmitter.emit();
    }
  }

  private updateFromVelocity(time: number, delta: number): void {
    // So switching to pointer mode won't remember a stale location.
    this.mouseDataSeries.clear();

    const velocity = this.velocityProperty.value;
    const wallResult = this.clampIfWalled(this.positionProperty.value + velocity * delta);

    if (wallResult.collided) {
      // Inelastic: stop dead. Elastic: reverse. Either way the impact is recorded cleanly (no
      // differentiated acceleration spike), the same as in acceleration mode.
      if (this.context.elasticWalls) {
        const bounce = this.bounceOffWall(wallResult.position, velocity, 0, delta);
        this.recordWallImpact(time, bounce.position, bounce.velocity, 0);
      } else {
        this.recordWallImpact(time, wallResult.position, 0, 0);
      }
      return;
    }

    this.velocityModelSeries.add(velocity, time);
    this.velocityGraphSeries.add(velocity, time);

    this.accelerationModelSeries.setData(this.estimatedCenteredDerivatives(this.velocityModelSeries));
    const acceleration = this.addDerivativeSample(
      this.accelerationGraphSeries,
      this.accelerationModelSeries,
      DERIVATIVE_RADIUS,
    );

    this.positionModelSeries.add(wallResult.position, time);
    this.positionGraphSeries.add(wallResult.position, time);

    this.setMousePosition(wallResult.position);
    this.positionProperty.value = wallResult.position;
    this.accelerationProperty.value = this.snapToZero(acceleration);
  }

  private updateFromAcceleration(time: number, delta: number): void {
    this.mouseDataSeries.clear();

    const acceleration = this.accelerationProperty.value;
    const newVelocity = this.velocityProperty.value + acceleration * delta;
    const estVelocity = (this.velocityProperty.value + newVelocity) / 2;
    const wallResult = this.clampIfWalled(this.positionProperty.value + estVelocity * delta);

    if (wallResult.collided) {
      if (this.context.elasticWalls) {
        // Bounce: reverse the velocity and keep accelerating (a ball bouncing under gravity).
        const bounce = this.bounceOffWall(wallResult.position, this.velocityProperty.value, acceleration, delta);
        this.recordWallImpact(time, bounce.position, bounce.velocity, acceleration);
      } else {
        // Stop at the wall, zero the acceleration too, then switch to velocity-driven so
        // subsequent steps hold the man still until the user moves a slider.
        this.setVelocityDriven();
        this.recordWallImpact(time, wallResult.position, 0, 0);
      }
      return;
    }

    this.accelerationModelSeries.add(acceleration, time);
    this.accelerationGraphSeries.add(acceleration, time);

    this.velocityGraphSeries.add(newVelocity, time);
    this.velocityModelSeries.add(newVelocity, time);
    this.positionGraphSeries.add(wallResult.position, time);
    this.positionModelSeries.add(wallResult.position, time);

    this.setMousePosition(wallResult.position);
    this.positionProperty.value = wallResult.position;
    this.velocityProperty.value = newVelocity;
  }

  /**
   * Record a slider-driven wall impact at `time`: the man ends the step at `position` with the
   * given post-impact velocity and acceleration. The velocity/acceleration derivative windows
   * restart from the impact, so the instantaneous change of velocity does not show up as a
   * differentiated acceleration spike in later steps. Fires collideEmitter.
   */
  private recordWallImpact(time: number, position: number, velocity: number, acceleration: number): void {
    this.velocityModelSeries.setData([{ value: velocity, time }]);
    this.accelerationModelSeries.setData([{ value: acceleration, time }]);

    this.positionModelSeries.add(position, time);
    this.positionGraphSeries.add(position, time);
    this.addGraphPoint(this.velocityGraphSeries, { value: velocity, time });
    this.addGraphPoint(this.accelerationGraphSeries, { value: acceleration, time });

    this.positionProperty.value = position;
    this.velocityProperty.value = velocity;
    this.accelerationProperty.value = acceleration;
    this.setMousePosition(position);

    this.collideEmitter.emit();
  }

  /**
   * Elastic bounce within one step, exact for constant acceleration: find the moment τ in the
   * step when x + v₀τ + ½aτ² reaches the wall, reverse the velocity there, and move on for the
   * rest of the step. (Simply mirroring the overshoot would let the man keep accelerating
   * "through" the wall and gain energy on every bounce.)
   *
   * @param wallPosition - the wall being hit
   * @param v0 - velocity at the start of the step
   * @param a - constant acceleration during the step
   * @param delta - step length
   */
  private bounceOffWall(wallPosition: number, v0: number, a: number, delta: number): WallBounce {
    const gap = wallPosition - this.positionProperty.value;
    let tau = delta;
    if (Math.abs(a) < 1e-12) {
      if (v0 !== 0) {
        tau = gap / v0;
      }
    } else {
      // ½aτ² + v₀τ − gap = 0; take the earliest root inside the step.
      const discriminant = Math.max(0, v0 * v0 + 2 * a * gap);
      const sqrt = Math.sqrt(discriminant);
      const roots = [(-v0 + sqrt) / a, (-v0 - sqrt) / a].filter((r) => r >= 0 && r <= delta + 1e-12);
      tau = roots.length > 0 ? Math.min(...roots) : delta;
    }
    tau = Math.min(Math.max(tau, 0), delta);

    const rest = delta - tau;
    const velocityAfterImpact = -(v0 + a * tau);
    return {
      position: this.clampIfWalled(wallPosition + velocityAfterImpact * rest + 0.5 * a * rest * rest).position,
      velocity: velocityAfterImpact + a * rest,
    };
  }

  // ── Pointer input ─────────────────────────────────────────────────────────────

  /**
   * Set the pointer's target model x, clamped to the walls. While paused this also moves the man
   * immediately so dragging repositions him without stepping; while running, the step loop reads
   * this target on the next frame. No-op when `x` is unchanged.
   *
   * @param x - target position in model meters (pre-clamp).
   */
  public setMousePosition(x: number): void {
    if (this.mousePosition !== x) {
      this.mousePosition = this.clampIfWalled(x).position;
      if (this.context.isPaused()) {
        this.positionProperty.value = this.mousePosition;
      }
    }
  }

  public getMousePosition(): number {
    return this.mousePosition;
  }

  // ── Walls ─────────────────────────────────────────────────────────────────────

  /**
   * Clamp x to the walls (if enabled), reporting whether a collision occurred.
   *
   * Returns a FRESH result object every call (as the Java original's `new WallResult`
   * does). It must not be a shared/reused instance: callers hold the returned object
   * across a later `setMousePosition()`, which itself calls `clampIfWalled` — a shared
   * object would get its `collided` flag clobbered before the caller reads it, so a
   * velocity-mode wall hit would fail to zero the velocity or fire the collision.
   */
  public clampIfWalled(x: number): WallResult {
    if (this.context.wallsEnabled) {
      const half = this.context.halfContainerWidth;
      if (x < -half) {
        return { position: -half, collided: true };
      }
      if (x > half) {
        return { position: half, collided: true };
      }
    }
    return { position: x, collided: false };
  }

  /**
   * Whether x sits exactly on a wall. Exact float equality is intentional: clampIfWalled returns
   * the wall coordinate itself, so a clamped man is *exactly* ±halfContainerWidth. A tolerance
   * here would also fire for a man standing just inside the wall, emitting duplicate collisions.
   */
  private hitsWall(x: number): boolean {
    if (!this.context.wallsEnabled) {
      return false;
    }
    return -this.context.halfContainerWidth === x || this.context.halfContainerWidth === x;
  }

  // ── Derivative bookkeeping ────────────────────────────────────────────────────

  private snapToZero(value: number): number {
    return Math.abs(value) < ZERO_THRESHOLD ? 0 : value;
  }

  /**
   * Look up the point in `series` at `lookupTime` (within half a step), or null if there is none.
   */
  private getPointAtTime(series: DataSeries, lookupTime: number): DataPoint | null {
    for (let i = series.size() - 1; i >= 0; i--) {
      const point = series.getPoint(i);
      if (point && Math.abs(point.time - lookupTime) < FIXED_DT * 0.5) {
        return { value: point.value, time: point.time };
      }
    }
    return null;
  }

  /**
   * Take the derivative estimate `stepsAgo` steps back from `modelSeries`, add it to
   * `graphSeries` at that sample's own time (see addGraphPoint), and return its value for the
   * live readout (0 if there is no sample yet).
   */
  private addDerivativeSample(graphSeries: DataSeries, modelSeries: DataSeries, stepsAgo: number): number {
    const point = this.getPointAtTime(modelSeries, this.getTimeNTimeStepsAgo(stepsAgo));
    if (!point) {
      return modelSeries.getLastPoint()?.value ?? 0;
    }
    this.addGraphPoint(graphSeries, point);
    return point.value;
  }

  /**
   * Append to a graph series only if the point is later than its last one. Derivative samples are
   * stamped with their (lagged) centered time, so right after a reset, a strategy switch or a wall
   * impact the candidate time can repeat or fall behind points already plotted; those are dropped
   * so every graph series stays strictly increasing in time.
   */
  private addGraphPoint(graphSeries: DataSeries, point: DataPoint): void {
    const last = graphSeries.getLastPoint();
    if (!last || point.time > last.time + FIXED_DT * 0.5) {
      graphSeries.addPoint(point);
    }
  }

  /** Centered least-squares derivative of every point in the series. */
  private estimatedCenteredDerivatives(series: DataSeries): DataPoint[] {
    const radius = DERIVATIVE_RADIUS;
    const points: DataPoint[] = [];
    for (let i = 0; i < series.size(); i++) {
      const point = series.getPoint(i);
      if (point) {
        points.push({
          value: estimateDerivative(series.getPointsInRange(i - radius, i + radius)),
          time: point.time,
        });
      }
    }
    return points;
  }

  /**
   * The step time `n` steps before the latest one. While fewer than n+1 steps have been taken
   * since the history was (re)started, this is the oldest remembered time, so the lagged sample
   * time never runs ahead of the true centered time.
   */
  private getTimeNTimeStepsAgo(n: number): number {
    const index = Math.max(0, this.times.length - 1 - n);
    return this.times[index] ?? this.time;
  }
}
