/**
 * DataSeries.ts
 *
 * A time series of { time, value } samples. Ported from the original data-series.js.
 * Two specializations bound how much is retained:
 *   - LimitedSizeDataSeries acts as a fixed-length FIFO queue (used for the rolling
 *     windows that feed the centered-derivative estimates).
 *   - LimitedTimeDataSeries ignores samples past a maximum time (used for the graph
 *     series, which only ever display up to MAX_TIME seconds).
 */

export type DataPoint = { time: number; value: number };

export class DataSeries {
  protected data: DataPoint[] = [];

  /** Append a sample. */
  public add(value: number, time: number): void {
    this.data.push({ value, time });
  }

  /** Append an existing point object. */
  public addPoint(point: DataPoint): void {
    this.data.push(point);
  }

  public size(): number {
    return this.data.length;
  }

  public getPoint(i: number): DataPoint | undefined {
    return this.data[i];
  }

  /** All points whose indices lie in [start, end], inclusive, clamped to the series. */
  public getPointsInRange(start: number, end: number): DataPoint[] {
    const points: DataPoint[] = [];
    const size = this.size();
    for (let i = start; i <= end; i++) {
      const point = this.getPoint(i);
      if (point && i >= 0 && i < size) {
        points.push(point);
      }
    }
    return points;
  }

  public getLastPoint(): DataPoint | null {
    return this.data[this.data.length - 1] ?? null;
  }

  /**
   * Returns the right-of-center point. For [0,1,2,3,4] this is 2; for [0,1,2,3] it
   * is also 2. Matches PhET's behavior.
   */
  public getMidPoint(): DataPoint | null {
    return this.data[Math.floor(this.data.length / 2)] ?? null;
  }

  public clear(): void {
    this.data = [];
  }

  /** Drop every sample whose time is at or after the given time. */
  public clearPointsAfter(time: number): void {
    this.data = this.data.filter((point) => point.time < time);
  }

  public setData(data: DataPoint[]): void {
    this.data = data;
  }
}

/** A time series that ignores any sample past maxTime. */
export class LimitedTimeDataSeries extends DataSeries {
  private readonly maxTime: number;

  public constructor(maxTime: number) {
    super();
    this.maxTime = maxTime;
  }

  public override add(value: number, time: number): void {
    if (time <= this.maxTime) {
      super.add(value, time);
    }
  }

  public override addPoint(point: DataPoint): void {
    if (point.time <= this.maxTime) {
      super.addPoint(point);
    }
  }
}

/** A fixed-length FIFO time series. */
export class LimitedSizeDataSeries extends DataSeries {
  private readonly maxSize: number;

  public constructor(maxSize: number) {
    super();
    this.maxSize = maxSize;
  }

  public override add(value: number, time: number): void {
    super.add(value, time);
    this.trim();
  }

  public override addPoint(point: DataPoint): void {
    super.addPoint(point);
    this.trim();
  }

  private trim(): void {
    while (this.data.length > this.maxSize) {
      this.data.shift();
    }
  }
}
