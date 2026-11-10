/**
 * Kinematics checked against closed-form answers: integration accuracy, exact preset
 * derivatives, alignment of the x / v / a graphs in time, and wall behaviour.
 */

import { afterEach, describe, expect, it } from "vitest";
import type { DataSeries } from "../../../src/common/model/DataSeries.js";
import { FUNCTION_PRESETS, type MovingManFunctionPreset } from "../../../src/common/model/functionPresets.js";
import { MotionStrategy } from "../../../src/common/model/MotionStrategy.js";
import { MovingManModel } from "../../../src/common/model/MovingManModel.js";
import MovingManConstants from "../../../src/MovingManConstants.js";

const FIXED_DT: number = MovingManConstants.FIXED_DT;
const RADIUS: number = MovingManConstants.DERIVATIVE_RADIUS;
const HALF_WIDTH: number = MovingManConstants.HALF_CONTAINER_WIDTH;

const preset = (label: string): MovingManFunctionPreset => {
  const found = FUNCTION_PRESETS.find((p) => p.labelString === label);
  if (!found) {
    throw new Error(`no preset ${label}`);
  }
  return found;
};

const stepN = (model: MovingManModel, n: number): void => {
  for (let i = 0; i < n; i++) {
    model.step(FIXED_DT);
  }
};

const points = (series: DataSeries) =>
  Array.from({ length: series.size() }, (_, i) => series.getPoint(i)).filter((p) => p !== undefined);

/** Time at which the series first crosses zero going in either direction, linearly interpolated. */
const firstZeroCrossingAfter = (series: DataSeries, after: number): number => {
  const pts = points(series).filter((p) => p.time > after);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (a && b && a.value !== 0 && Math.sign(a.value) !== Math.sign(b.value)) {
      return a.time + ((b.time - a.time) * -a.value) / (b.value - a.value);
    }
  }
  return Number.NaN;
};

/** Time of the largest value in the series. */
const timeOfMax = (series: DataSeries): number => {
  let best = { time: Number.NaN, value: Number.NEGATIVE_INFINITY };
  for (const p of points(series)) {
    if (p.value > best.value) {
      best = p;
    }
  }
  return best.time;
};

const expectStrictlyIncreasingTimes = (series: DataSeries): void => {
  const pts = points(series);
  for (let i = 1; i < pts.length; i++) {
    expect(pts[i]?.time).toBeGreaterThan(pts[i - 1]?.time ?? Number.NEGATIVE_INFINITY);
  }
};

describe("kinematics", () => {
  let model: MovingManModel;

  afterEach(() => {
    model?.reset();
  });

  it("derives its buffer sizes from DERIVATIVE_RADIUS", () => {
    expect(MovingManConstants.SERIES_SIZE_LIMIT).toBeGreaterThanOrEqual(4 * RADIUS + 1);
    expect(MovingManConstants.NUM_TIME_POINTS_TO_RECORD).toBeGreaterThan(2 * RADIUS);
  });

  it("constant acceleration integrates to x = ½at² exactly (trapezoidal rule)", () => {
    model = new MovingManModel({ noRecording: true });
    model.wallsEnabledProperty.value = false;
    model.movingMan.setAccelerationDriven();
    model.movingMan.accelerationProperty.value = 2;
    model.play();
    stepN(model, 24); // 1 s

    expect(model.timeProperty.value).toBeCloseTo(1, 12);
    expect(model.movingMan.velocityProperty.value).toBeCloseTo(2, 12);
    expect(model.movingMan.positionProperty.value).toBeCloseTo(1, 12);
  });

  it("the t² − 8 preset reads a = 2 and v = 2t exactly, with no lag", () => {
    model = new MovingManModel();
    model.movingMan.functionProperty.value = preset("t² − 8");
    stepN(model, 36); // 1.5 s

    const t = model.timeProperty.value;
    expect(model.movingMan.accelerationProperty.value).toBe(2);
    expect(model.movingMan.velocityProperty.value).toBeCloseTo(2 * t, 12);
    for (const p of points(model.movingMan.accelerationGraphSeries)) {
      expect(p.value).toBe(2);
    }
    expect(model.movingMan.velocityGraphSeries.getLastPoint()?.time).toBeCloseTo(t, 12);
  });

  it("with 7·sin(t), v is exactly 0 where x peaks", () => {
    model = new MovingManModel();
    const sine = preset("7·sin(t)");
    model.movingMan.functionProperty.value = sine;
    stepN(model, 60); // 2.5 s, past the peak at π/2

    for (const p of points(model.movingMan.velocityGraphSeries)) {
      expect(p.value).toBeCloseTo(sine.velocity(p.time), 12);
    }
    expect(firstZeroCrossingAfter(model.movingMan.velocityGraphSeries, 0.5)).toBeCloseTo(Math.PI / 2, 2);
  });

  it("a stops at the wall and reads 0 while the preset presses into it", () => {
    model = new MovingManModel({ noRecording: true });
    let collisions = 0;
    model.movingMan.collideEmitter.addListener(() => collisions++);
    model.movingMan.functionProperty.value = preset("3·t − 5"); // reaches +10 m at t = 5 s
    stepN(model, 24 * 6);

    expect(model.movingMan.positionProperty.value).toBe(HALF_WIDTH);
    expect(model.movingMan.velocityProperty.value).toBe(0);
    expect(model.movingMan.accelerationProperty.value).toBe(0);
    expect(collisions).toBe(1);
  });

  it("dragging keeps the x, v and a graphs aligned in time", () => {
    model = new MovingManModel();
    model.wallsEnabledProperty.value = false;
    model.movingMan.setPositionDriven();
    model.play();
    // Drag the man along x = 5·sin(t) for 4 s.
    for (let i = 1; i <= 96; i++) {
      model.movingMan.setMousePosition(5 * Math.sin(i * FIXED_DT));
      model.step(FIXED_DT);
    }
    const man = model.movingMan;

    // v crosses zero where x peaks, and a crosses zero where x does: within a fraction of a
    // step, rather than RADIUS (v) or 2·RADIUS (a) steps late as when the samples were restamped
    // with the current time.
    expect(
      Math.abs(firstZeroCrossingAfter(man.velocityGraphSeries, 0.5) - timeOfMax(man.positionGraphSeries)),
    ).toBeLessThan(FIXED_DT);
    expect(
      Math.abs(
        firstZeroCrossingAfter(man.accelerationGraphSeries, 1) - firstZeroCrossingAfter(man.positionGraphSeries, 1),
      ),
    ).toBeLessThan(FIXED_DT);

    // The derived lines end RADIUS and 2·RADIUS steps behind the cursor.
    const now = model.timeProperty.value;
    expect(man.velocityGraphSeries.getLastPoint()?.time).toBeCloseTo(now - RADIUS * FIXED_DT, 9);
    expect(man.accelerationGraphSeries.getLastPoint()?.time).toBeCloseTo(now - 2 * RADIUS * FIXED_DT, 9);
  });

  it("graph timestamps stay strictly increasing across strategy switches", () => {
    model = new MovingManModel();
    model.wallsEnabledProperty.value = false;
    const man = model.movingMan;
    model.play();
    for (let i = 1; i <= 20; i++) {
      man.setMousePosition(i * 0.05);
      model.step(FIXED_DT);
    }
    man.setVelocityDriven();
    man.velocityProperty.value = 2;
    stepN(model, 20);
    man.setAccelerationDriven();
    man.accelerationProperty.value = -1;
    stepN(model, 20);
    man.setPositionDriven();
    stepN(model, 20);

    expectStrictlyIncreasingTimes(man.positionGraphSeries);
    expectStrictlyIncreasingTimes(man.velocityGraphSeries);
    expectStrictlyIncreasingTimes(man.accelerationGraphSeries);
  });

  it("an inelastic wall stop in velocity mode leaves no acceleration spike", () => {
    model = new MovingManModel();
    let collisions = 0;
    model.movingMan.collideEmitter.addListener(() => collisions++);
    model.movingMan.setVelocityDriven();
    model.movingMan.positionProperty.value = 8;
    model.movingMan.velocityProperty.value = 6;
    model.play();
    stepN(model, 48);

    expect(collisions).toBe(1);
    expect(model.movingMan.positionProperty.value).toBe(HALF_WIDTH);
    expect(model.movingMan.velocityProperty.value).toBe(0);
    for (const p of points(model.movingMan.accelerationGraphSeries)) {
      expect(Math.abs(p.value)).toBeLessThan(1e-6);
    }
  });

  it("an inelastic wall stop in acceleration mode leaves no spike and hands over to velocity", () => {
    model = new MovingManModel();
    model.movingMan.setAccelerationDriven();
    model.movingMan.positionProperty.value = 8;
    model.movingMan.accelerationProperty.value = 4;
    model.play();
    stepN(model, 48);

    expect(model.movingMan.motionStrategyProperty.value).toBe(MotionStrategy.VELOCITY);
    expect(model.movingMan.velocityProperty.value).toBe(0);
    for (const p of points(model.movingMan.accelerationGraphSeries)) {
      expect(Math.abs(p.value)).toBeLessThanOrEqual(4 + 1e-9);
    }
  });

  it("elastic walls reverse the velocity in velocity mode", () => {
    model = new MovingManModel({ noRecording: true });
    model.elasticWallsProperty.value = true;
    model.movingMan.setVelocityDriven();
    model.movingMan.positionProperty.value = 9;
    model.movingMan.velocityProperty.value = 6;
    model.play();
    stepN(model, 24);

    expect(model.movingMan.velocityProperty.value).toBe(-6);
    // 1 m to the wall and back 5 m: x = 10 − (6·1 − 1) = 5.
    expect(model.movingMan.positionProperty.value).toBeCloseTo(5, 9);
    expect(model.movingMan.motionStrategyProperty.value).toBe(MotionStrategy.VELOCITY);
  });

  it("elastic walls make a constant acceleration bounce like a ball, conserving energy", () => {
    model = new MovingManModel({ noRecording: true });
    model.elasticWallsProperty.value = true;
    let bounces = 0;
    model.movingMan.collideEmitter.addListener(() => bounces++);
    const a = 5;
    model.movingMan.setAccelerationDriven();
    model.movingMan.positionProperty.value = 5;
    model.movingMan.accelerationProperty.value = a;
    model.play();

    // "Energy" per unit mass with a constant acceleration toward +x: ½v² − a·x.
    const energy = (): number =>
      0.5 * model.movingMan.velocityProperty.value ** 2 - a * model.movingMan.positionProperty.value;
    const initial = energy();
    for (let i = 0; i < 24 * 10; i++) {
      model.step(FIXED_DT);
      expect(model.movingMan.positionProperty.value).toBeLessThanOrEqual(HALF_WIDTH);
    }
    expect(bounces).toBeGreaterThanOrEqual(3);
    expect(model.movingMan.motionStrategyProperty.value).toBe(MotionStrategy.ACCELERATION);
    expect(Math.abs(energy() - initial)).toBeLessThan(0.05 * Math.abs(initial));
  });

  it("playback does not overwrite the walls setting", () => {
    model = new MovingManModel();
    model.wallsEnabledProperty.value = true;
    model.play();
    stepN(model, 24);
    model.stopRecording();

    model.wallsEnabledProperty.value = false;
    model.play();
    stepN(model, 12);
    model.setPlaybackTime(0.5);
    expect(model.wallsEnabledProperty.value).toBe(false);
  });

  it("recording over a run truncates the history at the cursor", () => {
    model = new MovingManModel();
    model.movingMan.setVelocityDriven();
    model.movingMan.velocityProperty.value = 1;
    model.play();
    stepN(model, 48);
    model.stopRecording();
    model.setPlaybackTime(1);
    model.record();

    expect(model.furthestRecordedTimeProperty.value).toBe(1);
    for (const series of [model.movingMan.positionGraphSeries, model.movingMan.velocityGraphSeries]) {
      expect(series.getLastPoint()?.time ?? 0).toBeLessThan(1);
    }
    model.play();
    stepN(model, 24);
    expectStrictlyIncreasingTimes(model.movingMan.positionGraphSeries);
    expectStrictlyIncreasingTimes(model.movingMan.velocityGraphSeries);
    expectStrictlyIncreasingTimes(model.movingMan.accelerationGraphSeries);
  });
});
