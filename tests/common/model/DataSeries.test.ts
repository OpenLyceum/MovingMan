import { describe, expect, it } from "vitest";
import { DataSeries, LimitedSizeDataSeries, LimitedTimeDataSeries } from "../../../src/common/model/DataSeries.js";

const fill = (series: DataSeries, times: number[]): DataSeries => {
  for (const t of times) {
    series.add(10 * t, t);
  }
  return series;
};

describe("DataSeries", () => {
  it("getPointsInRange is inclusive and clamps to the series", () => {
    const series = fill(new DataSeries(), [0, 1, 2, 3]);
    expect(series.getPointsInRange(-2, 1).map((p) => p.time)).toEqual([0, 1]);
    expect(series.getPointsInRange(2, 10).map((p) => p.time)).toEqual([2, 3]);
    expect(series.getPointsInRange(5, 8)).toEqual([]);
  });

  it("clearPointsAfter drops samples at or after the time", () => {
    const series = fill(new DataSeries(), [0, 1, 2, 3]);
    series.clearPointsAfter(2);
    expect(series.size()).toBe(2);
    expect(series.getLastPoint()?.time).toBe(1);
  });

  it("getMidPoint returns the right-of-center point (PhET behaviour)", () => {
    expect(fill(new DataSeries(), [0, 1, 2, 3, 4]).getMidPoint()?.time).toBe(2);
    expect(fill(new DataSeries(), [0, 1, 2, 3]).getMidPoint()?.time).toBe(2);
    expect(new DataSeries().getMidPoint()).toBeNull();
  });

  it("getClosestPoint finds the nearest sample by time", () => {
    const series = fill(new DataSeries(), [0, 1, 2, 3]);
    expect(new DataSeries().getClosestPoint(1)).toBeNull();
    expect(series.getClosestPoint(2)?.time).toBe(2);
    expect(series.getClosestPoint(1.2)?.time).toBe(1);
    expect(series.getClosestPoint(1.8)?.time).toBe(2);
    expect(series.getClosestPoint(1.5)?.time).toBe(1); // ties go to the earlier point
    expect(series.getClosestPoint(-5)?.time).toBe(0);
    expect(series.getClosestPoint(50)?.time).toBe(3);
  });
});

describe("LimitedSizeDataSeries", () => {
  it("keeps only the newest maxSize samples (FIFO)", () => {
    const series = fill(new LimitedSizeDataSeries(3), [0, 1, 2, 3, 4]);
    expect(series.size()).toBe(3);
    expect(series.getPoint(0)?.time).toBe(2);
    series.addPoint({ time: 5, value: 0 });
    expect(series.getPoint(0)?.time).toBe(3);
    expect(series.size()).toBe(3);
  });
});

describe("LimitedTimeDataSeries", () => {
  it("ignores samples past maxTime but accepts maxTime itself", () => {
    const series = fill(new LimitedTimeDataSeries(2), [0, 1, 2, 3]);
    series.addPoint({ time: 2.5, value: 0 });
    expect(series.size()).toBe(3);
    expect(series.getLastPoint()?.time).toBe(2);
  });
});
