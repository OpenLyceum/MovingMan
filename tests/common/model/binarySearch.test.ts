import { describe, expect, it } from "vitest";
import { closestIndex } from "../../../src/common/model/binarySearch.js";

describe("closestIndex", () => {
  it("returns -1 for an empty array", () => {
    expect(closestIndex([], 3)).toBe(-1);
  });

  it("returns 0 for a single element, whatever the target", () => {
    expect(closestIndex([5], -100)).toBe(0);
    expect(closestIndex([5], 100)).toBe(0);
  });

  it("finds an exact hit", () => {
    expect(closestIndex([0, 1, 2, 3, 4], 3)).toBe(3);
  });

  it("picks the nearer neighbour between two values", () => {
    expect(closestIndex([0, 1, 2, 3], 1.2)).toBe(1);
    expect(closestIndex([0, 1, 2, 3], 1.8)).toBe(2);
  });

  it("returns one of the two neighbours on an exact tie", () => {
    expect([1, 2]).toContain(closestIndex([0, 1, 2, 3], 1.5));
  });

  it("clamps targets outside the range to the ends", () => {
    expect(closestIndex([0, 1, 2], -10)).toBe(0);
    expect(closestIndex([0, 1, 2], 10)).toBe(2);
  });
});
