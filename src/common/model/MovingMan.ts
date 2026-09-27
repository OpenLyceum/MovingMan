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
  SERIES_SIZE_LIMIT,
  SERIES_TIME_LIMIT,
  NUM_TIME_POINTS_TO_RECORD,
} = MovingManConstants;

/** Below this magnitude the differentiated value wiggles around ±1e-12, so snap to 0. */
const ZERO_THRESHOLD = 1e-6;

/** What the man needs to know about the surrounding simulation. */
export interface ManContext {
  readonly wallsEnabled: boolean;
  readonly halfContainerWidth: number;
  isPaused(): boolean;
}

type WallResult = { position: number; collided: boolean };

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
      this.positionGraphSeries = new LimitedTimeDataSeries(SERIES_TIME_LIMIT);
      this.velocityGraphSeries = new LimitedTimeDataSeries(SERIES_TIME_LIMIT);
      this.accelerationGraphSeries = new LimitedTimeDataSeries(SERIES_TIME_LIMIT);
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
   * Drive position directly from a preset x(t), then differentiate to v and a using the
   * same centered-derivative pipeline as pointer-driven motion (minus the smoothing).
   */
  private updateFromFunction(time: number, preset: MovingManFunctionPreset): void {
    const previousPosition = this.positionProperty.value;

    const position = this.clampIfWalled(preset.evaluate(time)).position;
    // Feed the pointer-average window too, so dragging the man away from a running
    // preset hands control back smoothly (matches the original's expression branch).
    this.mouseDataSeries.add(position, time);
    this.positionModelSeries.add(position, time);

    // Differentiate position → velocity → acceleration.
    this.velocityModelSeries.setData(this.estimatedCenteredDerivatives(this.positionModelSeries));
    this.accelerationModelSeries.setData(this.estimatedCenteredDerivatives(this.velocityModelSeries));

    const velocitySampleTime = this.getTimeNTimeStepsAgo(DERIVATIVE_RADIUS);
    const accelerationSampleTime = this.getTimeNTimeStepsAgo(2 * DERIVATIVE_RADIUS);

    this.positionGraphSeries.add(position, time);
    this.velocityGraphSeries.addPoint(this.getPointAtTime(this.velocityModelSeries, velocitySampleTime, time));
    this.accelerationGraphSeries.addPoint(
      this.getPointAtTime(this.accelerationModelSeries, accelerationSampleTime, time),
    );

    this.positionProperty.value = position;
    this.velocityProperty.value = this.snapToZero(this.velocityGraphSeries.getLastPoint()?.value ?? 0);
    this.accelerationProperty.value = this.snapToZero(this.accelerationGraphSeries.getLastPoint()?.value ?? 0);

    this.setMousePosition(position);

    if (!this.hitsWall(previousPosition) && this.hitsWall(this.positionProperty.value)) {
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

    // Differentiate position → velocity → acceleration.
    this.velocityModelSeries.setData(this.estimatedCenteredDerivatives(this.positionModelSeries));
    this.accelerationModelSeries.setData(this.estimatedCenteredDerivatives(this.velocityModelSeries));

    // Read each derivative at its most-recent *fully centered* sample, where the
    // least-squares window is symmetric (and so smoothest / least jittery): velocity
    // DERIVATIVE_RADIUS steps back, acceleration twice that. The values are restamped with
    // the current time so the graphs still line up with "now"; the cost is a readout lag of
    // ~2*RADIUS*dt on acceleration. See DERIVATIVE_RADIUS in MovingManConstants.
    const velocitySampleTime = this.getTimeNTimeStepsAgo(DERIVATIVE_RADIUS);
    const accelerationSampleTime = this.getTimeNTimeStepsAgo(2 * DERIVATIVE_RADIUS);

    this.positionGraphSeries.add(position, time);
    this.velocityGraphSeries.addPoint(this.getPointAtTime(this.velocityModelSeries, velocitySampleTime, time));
    this.accelerationGraphSeries.addPoint(
      this.getPointAtTime(this.accelerationModelSeries, accelerationSampleTime, time),
    );

    this.positionProperty.value = position;
    this.velocityProperty.value = this.snapToZero(this.velocityGraphSeries.getLastPoint()?.value ?? 0);
    this.accelerationProperty.value = this.snapToZero(this.accelerationGraphSeries.getLastPoint()?.value ?? 0);

    if (!this.hitsWall(previousPosition) && this.hitsWall(this.positionProperty.value)) {
      this.collideEmitter.emit();
    }
  }

  private updateFromVelocity(time: number, delta: number): void {
    // So switching to pointer mode won't remember a stale location.
    this.mouseDataSeries.clear();

    const velocity = this.velocityProperty.value;
    this.velocityModelSeries.add(velocity, time);
    this.velocityGraphSeries.add(velocity, time);

    this.accelerationModelSeries.setData(this.estimatedCenteredDerivatives(this.velocityModelSeries));
    const accelerationMid = this.accelerationModelSeries.getMidPoint();
    if (accelerationMid) {
      this.accelerationGraphSeries.addPoint(accelerationMid);
    }

    const wallResult = this.clampIfWalled(this.positionProperty.value + velocity * delta);
    this.positionModelSeries.add(wallResult.position, time);
    this.positionGraphSeries.add(wallResult.position, time);

    this.setMousePosition(wallResult.position);
    this.positionProperty.value = wallResult.position;
    this.accelerationProperty.value = this.snapToZero(this.accelerationGraphSeries.getLastPoint()?.value ?? 0);

    if (wallResult.collided) {
      this.velocityProperty.value = 0;
      this.collideEmitter.emit();
    }
  }

  private updateFromAcceleration(time: number, delta: number): void {
    this.mouseDataSeries.clear();

    const acceleration = this.accelerationProperty.value;
    const newVelocity = this.velocityProperty.value + acceleration * delta;
    const estVelocity = (this.velocityProperty.value + newVelocity) / 2;
    const wallResult = this.clampIfWalled(this.positionProperty.value + estVelocity * delta);

    if (wallResult.collided) {
      // Stop at the wall: record zero velocity and the wall position directly so the
      // chart series have no spike. Zero acceleration too, then switch to velocity-driven
      // so subsequent steps hold the man still until the user moves a slider.
      const pos = wallResult.position;
      this.setVelocityDriven();

      this.accelerationModelSeries.add(acceleration, time);
      this.accelerationGraphSeries.add(acceleration, time);
      this.accelerationProperty.value = 0;

      this.velocityModelSeries.add(0, time);
      this.velocityGraphSeries.add(0, time);
      this.velocityProperty.value = 0;

      this.positionModelSeries.add(pos, time);
      this.positionGraphSeries.add(pos, time);
      this.positionProperty.value = pos;
      this.setMousePosition(pos);

      this.collideEmitter.emit();
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

  private hitsWall(x: number): boolean {
    return -this.context.halfContainerWidth === x || this.context.halfContainerWidth === x;
  }

  // ── Derivative bookkeeping ────────────────────────────────────────────────────

  private snapToZero(value: number): number {
    return Math.abs(value) < ZERO_THRESHOLD ? 0 : value;
  }

  /**
   * Look up the point in `series` whose time equals lookupTime, returning a copy
   * stamped with reportedTime. If no exact match exists (shouldn't happen with the
   * fixed timestep), fall back to the most recent point.
   */
  private getPointAtTime(series: DataSeries, lookupTime: number, reportedTime: number): DataPoint {
    for (let i = 0; i < series.size(); i++) {
      const point = series.getPoint(i);
      if (point && Math.abs(point.time - lookupTime) < FIXED_DT * 0.5) {
        return { value: point.value, time: reportedTime };
      }
    }
    return { value: series.getLastPoint()?.value ?? 0, time: reportedTime };
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

  private getTimeNTimeStepsAgo(n: number): number {
    let index = this.times.length - 1 - n;
    if (index < 0) {
      index = this.times.length - 1;
    }
    return this.times[index] ?? this.time;
  }
}
