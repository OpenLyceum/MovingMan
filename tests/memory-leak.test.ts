/**
 * Fleet-standard memory-leak regression suite.
 *
 * MovingManModel and the views are built once per screen and never disposed (the views declare
 * `isDisposable: false`; VariableControl is one of them), so describeDisposalLeaks() stays empty.
 * The coverage is instead:
 *
 *  - the model is dropped after every kind of session (acceleration-driven runs, recording,
 *    playback, preset functions, walls, Reset All) and must be collected as a unit, alone or with
 *    its own preferences model;
 *  - ChartNode links the model, colour profile and zoom Properties for the life of its screen, so
 *    driving the model must not pile listeners onto any of them.
 */

import { NumberProperty } from "scenerystack/axon";
import { describe, expect, it } from "vitest";
import { FUNCTION_PRESETS } from "../src/common/model/functionPresets.js";
import { MovingManModel } from "../src/common/model/MovingManModel.js";
import { ChartNode } from "../src/common/view/ChartNode.js";
import MovingManColors from "../src/MovingManColors.js";
import MovingManConstants from "../src/MovingManConstants.js";
import { MovingManPreferencesModel } from "../src/preferences/MovingManPreferencesModel.js";
import { describeDisposalLeaks, forceGC } from "./helpers/memoryLeak.js";

const FIXED_DT: number = MovingManConstants.FIXED_DT;

/** Listener count of a Property (public at runtime, private in the type declarations). */
const listenerCount = (property: object): number =>
  (property as unknown as { getListenerCount(): number }).getListenerCount();

function createAndDropModel(): WeakRef<object> {
  const model = new MovingManModel({ noRecording: true });
  model.movingMan.setAccelerationDriven();
  model.movingMan.accelerationProperty.value = 1;
  model.play();
  model.step(FIXED_DT);
  model.reset();
  return new WeakRef<object>(model);
}

/** The recording screen: record, stop, play back, scrub, take control, rewind and clear. */
function createAndDropRecordingModel(): WeakRef<object> {
  const model = new MovingManModel();
  driveRecording(model);
  return new WeakRef<object>(model);
}

function driveRecording(model: MovingManModel): void {
  model.movingMan.setVelocityDriven();
  model.movingMan.velocityProperty.value = 2;
  model.play();
  for (let i = 0; i < 60; i++) {
    model.step(FIXED_DT);
  }
  model.stepOnce();
  model.stopRecording();
  model.play();
  for (let i = 0; i < 30; i++) {
    model.step(FIXED_DT);
  }
  model.setPlaybackTime(1);
  model.takeControlFromPlayback();
  model.record();
  model.stepOnce();
  model.rewind();
  model.clear();
  model.reset();
}

/** Picking preset functions restarts the run; walls clamp the man. */
function driveFunctionsAndWalls(model: MovingManModel): void {
  for (const preset of FUNCTION_PRESETS) {
    model.movingMan.functionProperty.value = preset;
    for (let i = 0; i < 20; i++) {
      model.step(FIXED_DT);
    }
  }
  model.movingMan.functionProperty.value = null;
  model.movingMan.setPositionDriven();
  model.wallsEnabledProperty.value = false;
  model.movingMan.setMousePosition(model.halfContainerWidth * 2);
  model.wallsEnabledProperty.value = true;
  model.elasticWallsProperty.value = true;
  model.movingMan.setVelocityDriven();
  model.movingMan.velocityProperty.value = 5;
  model.play();
  for (let i = 0; i < 120; i++) {
    model.step(FIXED_DT);
  }
  model.reset();
}

function createAndDropFunctionsModel(): WeakRef<object> {
  const model = new MovingManModel();
  driveFunctionsAndWalls(model);
  return new WeakRef<object>(model);
}

/** Model and preferences die together; the model's preference links must not outlive its own preferences. */
function createAndDropModelWithPreferences(): WeakRef<object>[] {
  const preferences = new MovingManPreferencesModel();
  const model = new MovingManModel({ preferences });
  preferences.wallsEnabledProperty.value = !preferences.wallsEnabledProperty.value;
  preferences.elasticWallsProperty.value = !preferences.elasticWallsProperty.value;
  preferences.showVelocityVectorProperty.value = !preferences.showVelocityVectorProperty.value;
  preferences.showAccelerationVectorProperty.value = !preferences.showAccelerationVectorProperty.value;
  driveRecording(model);
  preferences.reset();
  return [new WeakRef<object>(model), new WeakRef<object>(preferences)];
}

const survivors = (refs: readonly WeakRef<object>[]): number => refs.filter((r) => r.deref() !== undefined).length;

describe("Memory leak regression", () => {
  it("MovingManModel is collected after drop", async () => {
    const ref = createAndDropModel();
    await forceGC(ref);
    expect(ref.deref()).toBeUndefined();
  });

  it("repeated create/drop cycles leave no survivors", async () => {
    const refs: WeakRef<object>[] = [];
    for (let i = 0; i < 10; i++) {
      refs.push(createAndDropModel());
    }
    await forceGC(refs);
    expect(survivors(refs)).toBe(0);
  });
});

describe("recording model is collected after drop", () => {
  it("after record / playback / scrub / rewind cycles", async () => {
    const refs = Array.from({ length: 10 }, createAndDropRecordingModel);
    await forceGC(refs);
    expect(survivors(refs)).toBe(0);
  });

  it("after preset functions, walls and elastic bouncing", async () => {
    const refs = Array.from({ length: 10 }, createAndDropFunctionsModel);
    await forceGC(refs);
    expect(survivors(refs)).toBe(0);
  });

  it("together with its own preferences model", async () => {
    const refs = Array.from({ length: 10 }, createAndDropModelWithPreferences).flat();
    await forceGC(refs);
    expect(survivors(refs)).toBe(0);
  });

  it("a long-lived preferences model keeps a fixed number of listeners per model, not per action", () => {
    const preferences = new MovingManPreferencesModel();
    const model = new MovingManModel({ preferences });
    const properties = [
      preferences.wallsEnabledProperty,
      preferences.elasticWallsProperty,
      preferences.showVelocityVectorProperty,
      preferences.showAccelerationVectorProperty,
    ];
    const before = properties.map(listenerCount);
    for (let i = 0; i < 5; i++) {
      driveRecording(model);
      driveFunctionsAndWalls(model);
      preferences.reset();
    }
    expect(properties.map(listenerCount)).toEqual(before);
  });
});

describe("driving the model does not accumulate listeners", () => {
  it("model and series Properties keep the same listeners across sessions", () => {
    const model = new MovingManModel();
    const man = model.movingMan;
    const properties = [
      model.isPlayingProperty,
      model.recordingProperty,
      model.timeProperty,
      model.furthestRecordedTimeProperty,
      model.wallsEnabledProperty,
      model.playbackSpeedProperty,
      man.positionProperty,
      man.velocityProperty,
      man.accelerationProperty,
      man.motionStrategyProperty,
      man.functionProperty,
    ];
    const before = properties.map(listenerCount);
    for (let i = 0; i < 5; i++) {
      driveRecording(model);
      driveFunctionsAndWalls(model);
    }
    expect(properties.map(listenerCount)).toEqual(before);
  });

  it("ChartNode: sessions leave model, zoom and colour listeners unchanged", () => {
    const model = new MovingManModel();
    const valueZoomLevelProperty = new NumberProperty(0, { numberType: "Integer" });
    const timeZoomLevelProperty = new NumberProperty(0, { numberType: "Integer" });
    new ChartNode(model, model.timeProperty, {
      series: model.movingMan.positionGraphSeries,
      color: "red",
      valueZoomLevelProperty,
      valueLevels: MovingManConstants.POSITION_ZOOM_LEVELS,
      timeZoomLevelProperty,
      timeLevels: MovingManConstants.TIME_ZOOM_LEVELS,
      width: 400,
      height: 200,
    });
    const properties = [
      model.timeProperty,
      model.recordingProperty,
      valueZoomLevelProperty,
      timeZoomLevelProperty,
      MovingManColors.chartBackgroundProperty,
      MovingManColors.chartGridProperty,
    ];
    const before = properties.map(listenerCount);
    for (let i = 0; i < 5; i++) {
      driveRecording(model);
      driveFunctionsAndWalls(model);
      valueZoomLevelProperty.value = 1;
      timeZoomLevelProperty.value = 2;
      valueZoomLevelProperty.value = 0;
      timeZoomLevelProperty.value = 0;
    }
    expect(properties.map(listenerCount)).toEqual(before);
  });
});

describeDisposalLeaks([]);
