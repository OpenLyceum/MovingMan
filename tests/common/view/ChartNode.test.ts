import { describe, expect, it } from "vitest";
import { DataSeries } from "../../../src/common/model/DataSeries.js";
import { tangentSegment, timeWindowStart } from "../../../src/common/view/ChartNode.js";

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

describe("tangentSegment", () => {
  const sampled = (f: (t: number) => number): DataSeries => {
    const series = new DataSeries();
    for (let i = 0; i <= 96; i++) {
      series.add(f(i / 24), i / 24);
    }
    return series;
  };

  it("touches x = t² at the cursor with slope v = 2t", () => {
    const segment = tangentSegment(
      sampled((t) => t * t),
      sampled((t) => 2 * t),
      3,
      0.5,
    );
    expect(segment).not.toBeNull();
    // Line through (3, 9) with slope 6.
    expect(segment?.x1).toBeCloseTo(2.5, 12);
    expect(segment?.y1).toBeCloseTo(6, 12);
    expect(segment?.x2).toBeCloseTo(3.5, 12);
    expect(segment?.y2).toBeCloseTo(12, 12);
  });

  it("anchors at the latest slope sample while the derivative trails the cursor", () => {
    const slope = new DataSeries();
    slope.add(1, 1); // v known only up to t = 1
    const position = sampled((t) => t);
    const segment = tangentSegment(position, slope, 1.2, 0.5);
    expect(segment?.x1).toBeCloseTo(0.5, 12);
    expect(segment?.y1).toBeCloseTo(0.5, 12);
  });

  it("is hidden (null) when there is nothing near the cursor", () => {
    expect(tangentSegment(new DataSeries(), new DataSeries(), 1, 0.5)).toBeNull();
    expect(
      tangentSegment(
        sampled((t) => t),
        sampled(() => 1),
        10,
        0.5,
      ),
    ).toBeNull();
  });
});
