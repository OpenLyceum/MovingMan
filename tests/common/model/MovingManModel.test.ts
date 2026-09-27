import { afterEach, describe, expect, it } from "vitest";
import { MovingManModel } from "../../../src/common/model/MovingManModel.js";
import MovingManConstants from "../../../src/MovingManConstants.js";

const FIXED_DT: number = MovingManConstants.FIXED_DT;
const HALF_CONTAINER_WIDTH: number = MovingManConstants.HALF_CONTAINER_WIDTH;

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
});
