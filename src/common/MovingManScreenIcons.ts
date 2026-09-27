/**
 * MovingManScreenIcons.ts
 *
 * Programmatic home-screen / navigation-bar icons for both Moving Man screens.
 * Drawn on the standard PhET 548 × 373 icon canvas using MovingManColors.
 *
 *   Intro  — the photographic Moving Man on the playground with velocity /
 *            acceleration arrows.
 *   Charts — three stacked position / velocity / acceleration plots.
 */
import { Shape } from "scenerystack/kite";
import { Image, LinearGradient, Node, Path, Rectangle, type TColor } from "scenerystack/scenery";
import { ArrowNode } from "scenerystack/scenery-phet";
import { ScreenIcon } from "scenerystack/sim";
import standingImageUrl from "../assets/images/man-standing.gif";
import MovingManColors from "../MovingManColors.js";

const W = 548;
const H = 373;

function iconFrom(content: Node, fill: TColor): ScreenIcon {
  return new ScreenIcon(content, {
    maxIconWidthProportion: 1,
    maxIconHeightProportion: 1,
    fill,
  });
}

const ARROW_OPTIONS = { headHeight: 26, headWidth: 30, tailWidth: 12, stroke: null };

// Native pixel size of the standing-man art (feet flush with the bottom edge).
const STANDING_NATIVE = { width: 150, height: 401 };

function createIntroIconNode(): Node {
  const groundLineY = H * 0.72;

  const sky = new Rectangle(0, 0, W, groundLineY, {
    fill: new LinearGradient(0, 0, 0, groundLineY)
      .addColorStop(0, MovingManColors.skyTopProperty)
      .addColorStop(1, MovingManColors.skyBottomProperty),
  });
  const ground = new Rectangle(0, groundLineY, W, H - groundLineY, {
    fill: MovingManColors.groundProperty,
  });

  const manHeight = H * 0.66;
  const man = new Image(standingImageUrl, {
    scale: manHeight / STANDING_NATIVE.height,
    initialWidth: STANDING_NATIVE.width,
    initialHeight: STANDING_NATIVE.height,
  });
  man.centerX = W * 0.36;
  man.bottom = groundLineY + 2;

  const tailX = man.right + 10;
  const velocityArrow = new ArrowNode(tailX, H * 0.3, tailX + 150, H * 0.3, {
    ...ARROW_OPTIONS,
    fill: MovingManColors.velocityProperty,
  });
  const accelerationArrow = new ArrowNode(tailX, H * 0.46, tailX + 95, H * 0.46, {
    ...ARROW_OPTIONS,
    fill: MovingManColors.accelerationProperty,
  });

  return new Node({ children: [sky, ground, man, velocityArrow, accelerationArrow] });
}

const PADDING = 26;
const ROW_GAP = 14;
const CURVE_SAMPLES = 64;
const CYCLES = 1;

function buildChartRow(width: number, height: number, color: TColor, shapeFn: (theta: number) => number): Node {
  const baseline = height / 2;
  const amplitude = height * 0.34;

  const grid = new Shape();
  grid.moveTo(0, baseline).lineTo(width, baseline);
  const verticals = 4;
  for (let i = 1; i < verticals; i++) {
    const x = (width * i) / verticals;
    grid.moveTo(x, height * 0.12).lineTo(x, height * 0.88);
  }

  const curve = new Shape();
  for (let i = 0; i <= CURVE_SAMPLES; i++) {
    const u = i / CURVE_SAMPLES;
    const x = u * width;
    const y = baseline - amplitude * shapeFn(u * 2 * Math.PI * CYCLES);
    if (i === 0) {
      curve.moveTo(x, y);
    } else {
      curve.lineTo(x, y);
    }
  }

  return new Node({
    children: [
      new Path(grid, { stroke: MovingManColors.chartGridProperty, lineWidth: 1.5 }),
      new Path(curve, { stroke: color, lineWidth: 6, lineCap: "round", lineJoin: "round" }),
    ],
  });
}

function createChartsIconNode(): Node {
  const card = new Rectangle(0, 0, W, H, {
    fill: MovingManColors.chartBackgroundProperty,
    stroke: MovingManColors.chartBorderProperty,
    lineWidth: 2,
    cornerRadius: 10,
  });

  const plotWidth = W - 2 * PADDING;
  const rowHeight = (H - 2 * PADDING - 2 * ROW_GAP) / 3;

  const specs = [
    { color: MovingManColors.positionProperty, shape: (t: number) => Math.sin(t) },
    { color: MovingManColors.velocityProperty, shape: (t: number) => Math.cos(t) },
    { color: MovingManColors.accelerationProperty, shape: (t: number) => -Math.sin(t) },
  ];

  const rows = specs.map((spec, i) => {
    const row = buildChartRow(plotWidth, rowHeight, spec.color, spec.shape);
    row.x = PADDING;
    row.y = PADDING + i * (rowHeight + ROW_GAP);
    return row;
  });

  return new Node({ children: [card, ...rows] });
}

export function createIntroIcon(): ScreenIcon {
  return iconFrom(createIntroIconNode(), MovingManColors.skyBottomProperty);
}

export function createChartsIcon(): ScreenIcon {
  return iconFrom(createChartsIconNode(), MovingManColors.chartBackgroundProperty);
}
