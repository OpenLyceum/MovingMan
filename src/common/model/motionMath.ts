/**
 * motionMath.ts
 *
 * Estimates a derivative from a short time series using a least-squares regression
 * line and returning its slope. Ported from the original sim's MotionMath
 * (phet.common.motion.MotionMath).
 */

export type TimeValue = { time: number; value: number };

/**
 * Returns the slope of the least-squares line through the (time, value) points,
 * or 0 if the slope is undefined (e.g. all-equal times) or non-finite.
 */
export function estimateDerivative(series: readonly TimeValue[]): number {
  const n = series.length;
  if (n === 0) {
    return 0;
  }

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  for (const point of series) {
    sumX += point.time;
    sumY += point.value;
    sumXY += point.time * point.value;
    sumX2 += point.time * point.time;
  }

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) {
    return 0;
  }

  const slope = (n * sumXY - sumX * sumY) / denom;
  return Number.isFinite(slope) ? slope : 0;
}
