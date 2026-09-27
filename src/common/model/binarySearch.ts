/**
 * binarySearch.ts
 *
 * Finds the index of the value in a sorted-ascending array nearest to a target.
 * (The only piece of the original binarysearch library this sim actually used,
 * for locating the recorded state closest to the current playback time.)
 */

export function closestIndex(sortedAscending: readonly number[], target: number): number {
  const length = sortedAscending.length;
  if (length === 0) {
    return -1;
  }
  if (length === 1) {
    return 0;
  }

  let low = 0;
  let high = length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const value = sortedAscending[mid] as number;
    if (value < target) {
      low = mid + 1;
    } else if (value > target) {
      high = mid - 1;
    } else {
      return mid;
    }
  }

  // low is the insertion point; compare its neighbor to find the closer of the two.
  const lowIndex = Math.min(low, length - 1);
  const highIndex = Math.max(high, 0);
  const lowValue = sortedAscending[lowIndex] as number;
  const highValue = sortedAscending[highIndex] as number;
  return Math.abs(lowValue - target) < Math.abs(highValue - target) ? lowIndex : highIndex;
}
