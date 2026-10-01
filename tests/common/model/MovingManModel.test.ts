import { afterEach, describe, expect, it } from "vitest";
import { FUNCTION_PRESETS } from "../../../src/common/model/functionPresets.js";
import { MotionStrategy } from "../../../src/common/model/MotionStrategy.js";
import { MovingManModel } from "../../../src/common/model/MovingManModel.js";
import MovingManConstants from "../../../src/MovingManConstants.js";
import { MovingManPreferencesModel } from "../../../src/preferences/MovingManPreferencesModel.js";

const FIXED_DT: number = MovingManConstants.FIXED_DT;
const HALF_CONTAINER_WIDTH: number = MovingManConstants.HALF_CONTAINER_WIDTH;
const MAX_TIME: number = MovingManConstants.MAX_TIME;

/** Record a full MAX_TIME run on a Charts-style model (the man just stands still). */
function recordFullRun(model: MovingManModel): void {
  model.play();
  for (let i = 0; i < 2000 && model.isPlayingProperty.value; i++) {
    model.step(FIXED_DT);
  }
}

describe("MovingManModel", () => {
  let model: MovingManModel;

  afterEach(() => {
    model.reset();
  });

  it("integrates motion in acceleration mode", () => {
    model = new MovingManModel({ noRecording: true });
    const acceleration = 2;

    model.movingMan.setAccelerationDriven();
    model.movingMan.accelerationProperty.value = acceleration;
    model.play();
    model.step(FIXED_DT);

    expect(model.movingMan.velocityProperty.value).toBeCloseTo(acceleration * FIXED_DT, 6);
    expect(model.movingMan.positionProperty.value).toBeGreaterThan(0);
    expect(model.timeProperty.value).toBeCloseTo(FIXED_DT, 6);
  });

  it("reset restores time to zero", () => {
    model = new MovingManModel({ noRecording: true });
    model.movingMan.setAccelerationDriven();
    model.movingMan.accelerationProperty.value = 1;
    model.play();

    for (let i = 0; i < 5; i++) {
      model.step(FIXED_DT);
    }
    expect(model.timeProperty.value).toBeGreaterThan(0);

    model.reset();

    expect(model.timeProperty.value).toBeCloseTo(0, 6);
    expect(model.movingMan.positionProperty.value).toBeCloseTo(0, 6);
    expect(model.movingMan.velocityProperty.value).toBeCloseTo(0, 6);
  });

  it("velocity mode holds constant velocity while playing", () => {
    model = new MovingManModel({ noRecording: true });
    model.movingMan.setVelocityDriven();
    model.movingMan.velocityProperty.value = 1.5;
    model.play();
    model.step(FIXED_DT);
    model.step(FIXED_DT);

    expect(model.movingMan.velocityProperty.value).toBeCloseTo(1.5, 6);
    expect(model.movingMan.positionProperty.value).toBeCloseTo(3 * FIXED_DT, 5);
  });

  it("clamps position at the right wall", () => {
    model = new MovingManModel({ noRecording: true });
    model.movingMan.setVelocityDriven();
    model.movingMan.positionProperty.value = HALF_CONTAINER_WIDTH - 0.01;
    model.movingMan.velocityProperty.value = 10;
    model.play();
    for (let i = 0; i < 20; i++) {
      model.step(FIXED_DT);
    }
    expect(model.movingMan.positionProperty.value).toBeLessThanOrEqual(HALF_CONTAINER_WIDTH + 1e-6);
  });

  it("records up to exactly MAX_TIME and never steps past it", () => {
    model = new MovingManModel();
    recordFullRun(model);

    expect(model.isPlayingProperty.value).toBe(false);
    expect(model.timeProperty.value).toBe(MAX_TIME);
    expect(model.furthestRecordedTimeProperty.value).toBe(MAX_TIME);

    model.stepOnce();
    model.stepOnce();
    expect(model.timeProperty.value).toBe(MAX_TIME);
  });

  it("playback stops at the end of the recording and Play replays from the start", () => {
    model = new MovingManModel();
    recordFullRun(model);
    model.stopRecording();
    model.setPlaybackTime(MAX_TIME);

    model.stepOnce();
    expect(model.timeProperty.value).toBe(MAX_TIME);

    model.play();
    expect(model.timeProperty.value).toBe(0);
    model.step(FIXED_DT);
    expect(model.timeProperty.value).toBeCloseTo(FIXED_DT, 9);
  });

  it("choosing a preset makes position the driving quantity", () => {
    model = new MovingManModel({ noRecording: true });
    model.movingMan.setVelocityDriven();
    model.movingMan.functionProperty.value = FUNCTION_PRESETS[2] ?? null;
    for (let i = 0; i < 24; i++) {
      model.step(FIXED_DT);
    }
    expect(model.movingMan.motionStrategyProperty.value).toBe(MotionStrategy.POSITION);

    // Turning the preset off leaves the man where he is instead of running on.
    model.movingMan.functionProperty.value = null;
    const parked = model.movingMan.positionProperty.value;
    for (let i = 0; i < 24; i++) {
      model.step(FIXED_DT);
    }
    expect(model.movingMan.positionProperty.value).toBeCloseTo(parked, 6);
  });

  it("does not report a wall collision when walls are off", () => {
    model = new MovingManModel({ noRecording: true });
    model.wallsEnabledProperty.value = false;
    let collisions = 0;
    model.movingMan.collideEmitter.addListener(() => collisions++);

    model.play();
    model.movingMan.setPositionDriven();
    model.movingMan.setMousePosition(HALF_CONTAINER_WIDTH);
    for (let i = 0; i < 20; i++) {
      model.step(FIXED_DT);
    }
    expect(model.movingMan.positionProperty.value).toBe(HALF_CONTAINER_WIDTH);
    expect(collisions).toBe(0);
  });

  it("taking control during playback records over the rest of the run", () => {
    model = new MovingManModel();
    recordFullRun(model);
    model.stopRecording();
    model.setPlaybackTime(5);

    // Paused: switches to recording at the cursor and stays paused.
    model.takeControlFromPlayback();
    expect(model.recordingProperty.value).toBe(true);
    expect(model.isPlayingProperty.value).toBe(false);
    expect(model.furthestRecordedTimeProperty.value).toBeLessThanOrEqual(5);

    // Playing: switches to recording and keeps playing.
    model.stopRecording();
    model.play();
    model.step(FIXED_DT);
    model.takeControlFromPlayback();
    expect(model.recordingProperty.value).toBe(true);
    expect(model.isPlayingProperty.value).toBe(true);
  });

  it("applies preference changes immediately and as Reset All defaults", () => {
    const preferences = new MovingManPreferencesModel();
    model = new MovingManModel({ preferences });

    preferences.wallsEnabledProperty.value = false;
    preferences.showVelocityVectorProperty.value = true;
    expect(model.wallsEnabledProperty.value).toBe(false);
    expect(model.showVelocityVectorProperty.value).toBe(true);

    model.wallsEnabledProperty.value = true;
    model.reset();
    expect(model.wallsEnabledProperty.value).toBe(false);
    expect(model.showVelocityVectorProperty.value).toBe(true);
  });
});
