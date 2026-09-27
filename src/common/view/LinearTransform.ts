/**
 * LinearTransform.ts
 *
 * The 1-D model↔view mapping for the play area: model x (meters, 0 at track center)
 * to view x (pixels). Shared by the play-area scene, the man, the walls and the ruler.
 *
 * An optional `edgeInset` reserves a margin (px) on each side so the ±10 m ends sit
 * *inside* the play area rather than flush with its clipped edges — leaving room for the
 * brick walls and keeping the man fully on-screen when he reaches an end.
 */

import MovingManConstants from "../../MovingManConstants.js";

export class LinearTransform {
  public readonly pixelsPerMeter: number;
  public readonly centerX: number;

  public constructor(viewWidth: number, edgeInset = 0) {
    this.pixelsPerMeter = (viewWidth - 2 * edgeInset) / MovingManConstants.CONTAINER_WIDTH;
    this.centerX = viewWidth / 2;
  }

  public modelToViewX(modelX: number): number {
    return this.centerX + modelX * this.pixelsPerMeter;
  }

  public viewToModelX(viewX: number): number {
    return (viewX - this.centerX) / this.pixelsPerMeter;
  }
}
