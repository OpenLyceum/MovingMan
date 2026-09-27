/**
 * Fleet-standard memory-leak regression suite.
 * Creates a MovingManModel (noRecording), resets it, drops the reference, and asserts GC.
 */

import { describe, expect, it } from "vitest";
import { MovingManModel } from "../src/common/model/MovingManModel.js";
import MovingManConstants from "../src/MovingManConstants.js";
import { describeDisposalLeaks, forceGC } from "./helpers/memoryLeak.js";

const FIXED_DT: number = MovingManConstants.FIXED_DT;

function createAndDropModel(): WeakRef<object> {
  const model = new MovingManModel({ noRecording: true });
  model.movingMan.setAccelerationDriven();
  model.movingMan.accelerationProperty.value = 1;
  model.play();
  model.step(FIXED_DT);
  model.reset();
  return new WeakRef<object>(model);
}

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
    expect(refs.filter((r) => r.deref() !== undefined).length).toBe(0);
  });
});

describeDisposalLeaks([]);
