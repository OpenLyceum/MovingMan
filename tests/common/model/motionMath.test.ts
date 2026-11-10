import { describe, expect, it } from "vitest";
import { estimateDerivative, type TimeValue } from "../../../src/common/model/motionMath.js";

const sample = (f: (t: number) => number, center: number, radius: number, dt: number): TimeValue[] => {
  const points: TimeValue[] = [];
  for (let k = -radius; k <= radius; k++) {
    const time = center + k * dt;
    points.push({ time, value: f(time) });
  }
  return points;
};

describe("estimateDerivative", () => {
  it("returns 0 for an empty series", () => {
    expect(estimateDerivative([])).toBe(0);
  });

  it("returns 0 when every sample has the same time (undefined slope)", () => {
    expect(
      estimateDerivative([
        { time: 1, value: 0 },
        { time: 1, value: 5 },
      ]),
    ).toBe(0);
  });

  it("is exact for linear data", () => {
    expect(estimateDerivative(sample((t) => 3 * t - 5, 2, 3, 1 / 24))).toBeCloseTo(3, 10);
  });

  it("gives the exact derivative at the center of a symmetric window on quadratic data", () => {
    // d/dt (t² − 8) = 2t; the least-squares slope of a parabola over a symmetric window is
    // exactly the tangent slope at the window's center.
    const center = 1.5;
    expect(estimateDerivative(sample((t) => t * t - 8, center, 3, 1 / 24))).toBeCloseTo(2 * center, 10);
  });

  it("is a two-point slope for two samples", () => {
    expect(
      estimateDerivative([
        { time: 0, value: 1 },
        { time: 0.5, value: 2 },
      ]),
    ).toBeCloseTo(2, 12);
  });
});
