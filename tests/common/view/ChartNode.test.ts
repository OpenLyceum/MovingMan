import { describe, expect, it } from "vitest";
import { timeWindowStart } from "../../../src/common/view/ChartNode.js";

describe("timeWindowStart", () => {
  it("stays at 0 until the cursor passes 90% of the window", () => {
    expect(timeWindowStart(0, 4, 20)).toBe(0);
    expect(timeWindowStart(3.6, 4, 20)).toBe(0);
  });

  it("slides with the cursor once it passes 90%", () => {
    expect(timeWindowStart(10, 4, 20)).toBeCloseTo(6.4, 9);
  });

  it("never slides past the end of the recordable range", () => {
    expect(timeWindowStart(20, 4, 20)).toBe(16);
    expect(timeWindowStart(20, 20, 20)).toBe(0);
  });
});
