/**
 * ChartNode.ts
 *
 * A bamboo-based time-series chart for one of the man's quantities on the Charts
 * screen. Draws background, grid lines, tick marks/labels, a zero axis, the data line,
 * and a vertical playback cursor that tracks the current simulation time. While in
 * playback mode the user can click or drag inside the chart to scrub.
 *
 * Both axes are zoomable. A per-chart value (y) zoom level and a shared time (x) zoom
 * level are passed in as integer NumberProperties; changing either rescales the
 * transform and the tick/grid spacing for that axis.
 */

import type { NumberProperty, TReadOnlyProperty } from "scenerystack/axon";
import {
  AxisLine,
  ChartRectangle,
  ChartTransform,
  GridLineSet,
  LinePlot,
  TickLabelSet,
  TickMarkSet,
} from "scenerystack/bamboo";
import { Range, Vector2 } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";
import { Orientation } from "scenerystack/phet-core";
import { KeyboardListener, Line, Node, RichDragListener, type TColor, Text } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { StringManager } from "../../i18n/StringManager.js";
import MovingManColors from "../../MovingManColors.js";
import type { DataSeries } from "../model/DataSeries.js";
import type { MovingManModel } from "../model/MovingManModel.js";

// Pixel insets reserved for tick labels around the plot rectangle.
const LEFT_INSET = 36; // y-axis labels
const BOTTOM_INSET = 22; // x-axis labels
const TOP_INSET = 6;
const RIGHT_INSET = 6;

const TICK_LABEL_FONT = new PhetFont(10);

const LINE_PLOT_LINE_WIDTH = 2;
const AXIS_LINE_WIDTH = 1;
const CURSOR_LINE_WIDTH = 1.5;

const GRID_LINE_WIDTH = 0.5;

// Model-time scrub speed (seconds per view-pixel of keyboard drag).
const SCRUB_PER_PX = 0.02;

/** One zoom level: axis extent `max` and tick/grid `step`, both in model units. */
export type ZoomLevel = { readonly max: number; readonly step: number };

export type ChartNodeOptions = {
  series: DataSeries;
  color: TColor;
  /** Per-chart value (y) zoom: integer level into `valueLevels`, range [0, n-1]. */
  valueZoomLevelProperty: NumberProperty;
  valueLevels: readonly ZoomLevel[];
  /** Shared time (x) zoom: integer level into `timeLevels`, range [0, n-1]. */
  timeZoomLevelProperty: NumberProperty;
  timeLevels: readonly ZoomLevel[];
  /** Total width and height in px of the ChartNode (including tick-label insets). */
  width: number;
  height: number;
};

export class ChartNode extends Node {
  private readonly chartTransform: ChartTransform;
  private readonly series: DataSeries;
  private readonly linePlot: LinePlot;
  private readonly cursorLine: Line;
  private readonly dataset: Vector2[] = [];
  private datasetSize = 0;
  private readonly timeProperty: TReadOnlyProperty<number>;

  public constructor(model: MovingManModel, timeProperty: TReadOnlyProperty<number>, options: ChartNodeOptions) {
    // This chart lives for the lifetime of the Charts screen and is never disposed; declare that
    // so the model/zoom/emitter links registered below are not mistaken for an unmanaged leak.
    super({ isDisposable: false });
    this.series = options.series;
    this.timeProperty = timeProperty;

    const valueLevel = options.valueLevels[options.valueZoomLevelProperty.value] ?? options.valueLevels[0];
    const timeLevel = options.timeLevels[options.timeZoomLevelProperty.value] ?? options.timeLevels[0];
    if (!(valueLevel && timeLevel)) {
      throw new Error("ChartNode requires at least one zoom level per axis");
    }

    const plotWidth = options.width - LEFT_INSET - RIGHT_INSET;
    const plotHeight = options.height - TOP_INSET - BOTTOM_INSET;

    const chartTransform = new ChartTransform({
      viewWidth: plotWidth,
      viewHeight: plotHeight,
      modelXRange: new Range(0, timeLevel.max),
      modelYRange: new Range(-valueLevel.max, valueLevel.max),
      // Bamboo's default has +y in model = -y in view. We want larger values up.
      modelYRangeInverted: false,
    });
    this.chartTransform = chartTransform;

    // Background and border.
    const chartRectangle = new ChartRectangle(chartTransform, {
      fill: MovingManColors.chartBackgroundProperty,
      stroke: MovingManColors.chartBorderProperty,
      lineWidth: 1,
    });

    // Grid lines. Horizontal lines are spaced by the value step; vertical by the time step.
    const horizontalGridLines = new GridLineSet(chartTransform, Orientation.VERTICAL, valueLevel.step, {
      stroke: MovingManColors.chartGridProperty,
      lineWidth: GRID_LINE_WIDTH,
    });
    const verticalGridLines = new GridLineSet(chartTransform, Orientation.HORIZONTAL, timeLevel.step, {
      stroke: MovingManColors.chartGridProperty,
      lineWidth: GRID_LINE_WIDTH,
    });

    // Tick marks and labels.
    const yTickMarks = new TickMarkSet(chartTransform, Orientation.VERTICAL, valueLevel.step, { edge: "min" });
    const yTickLabels = new TickLabelSet(chartTransform, Orientation.VERTICAL, valueLevel.step, {
      edge: "min",
      createLabel: (value: number) => new Text(ChartNode.formatTickValue(value), { font: TICK_LABEL_FONT }),
    });
    const xTickMarks = new TickMarkSet(chartTransform, Orientation.HORIZONTAL, timeLevel.step, { edge: "min" });
    const xTickLabels = new TickLabelSet(chartTransform, Orientation.HORIZONTAL, timeLevel.step, {
      edge: "min",
      createLabel: (value: number) => new Text(ChartNode.formatTickValue(value), { font: TICK_LABEL_FONT }),
    });

    // The zero-axis line, drawn as a slightly darker line at y = 0.
    const zeroAxis = new AxisLine(chartTransform, Orientation.HORIZONTAL, {
      stroke: MovingManColors.chartBorderProperty,
      lineWidth: AXIS_LINE_WIDTH,
    });

    // The series data line.
    this.linePlot = new LinePlot(chartTransform, this.dataset, {
      stroke: options.color,
      lineWidth: LINE_PLOT_LINE_WIDTH,
    });

    // Cursor that tracks the current playback time.
    this.cursorLine = new Line(0, 0, 0, plotHeight, {
      stroke: MovingManColors.chartCursorProperty,
      lineWidth: CURSOR_LINE_WIDTH,
      cursor: "ew-resize",
    });
    timeProperty.link(() => this.updateCursor());

    // The plot area is offset inside the ChartNode by the tick insets.
    const plotContainer = new Node({
      x: LEFT_INSET,
      y: TOP_INSET,
      children: [
        chartRectangle,
        verticalGridLines,
        horizontalGridLines,
        zeroAxis,
        // Clip the line plot and the playback cursor to the chart rectangle. Clipping the
        // cursor matters as much as clipping the line: when the (zoomed) time range is
        // smaller than the current time, the cursor's view-x lands far past the right edge,
        // and without a clip it would both draw outside the chart and — because clipArea
        // constrains bounds — stretch this node's bounds and the surrounding layout.
        new Node({
          clipArea: Shape.bounds(chartRectangle.bounds),
          children: [this.linePlot, this.cursorLine],
        }),
        yTickMarks,
        yTickLabels,
        xTickMarks,
        xTickLabels,
      ],
    });

    this.children = [plotContainer];

    // ── Zoom ──────────────────────────────────────────────────────────────────
    // Value (y) zoom: rescale the y range and the spacing of the y grid/ticks.
    options.valueZoomLevelProperty.link((level) => {
      const l = options.valueLevels[level];
      if (!l) {
        return;
      }
      chartTransform.setModelYRange(new Range(-l.max, l.max));
      horizontalGridLines.setSpacing(l.step);
      yTickMarks.setSpacing(l.step);
      yTickLabels.setSpacing(l.step);
    });
    // Time (x) zoom: rescale the x range and the spacing of the x grid/ticks, then
    // reposition the cursor (which is derived from the transform).
    options.timeZoomLevelProperty.link((level) => {
      const l = options.timeLevels[level];
      if (!l) {
        return;
      }
      chartTransform.setModelXRange(new Range(0, l.max));
      verticalGridLines.setSpacing(l.step);
      xTickMarks.setSpacing(l.step);
      xTickLabels.setSpacing(l.step);
      this.updateCursor();
    });

    // ── Scrubbing inside the chart ────────────────────────────────────────────
    // Click or drag inside the chart background to seek (only while in playback).
    // Home/End remain on KeyboardListener; Left/Right scrub via RichDragListener.
    const scrub = (globalX: number): void => {
      if (model.recordingProperty.value || model.noRecording) {
        return;
      }
      const localX = chartRectangle.globalToLocalPoint(new Vector2(globalX, 0)).x;
      const t = Math.max(0, Math.min(model.furthestRecordedTimeProperty.value, chartTransform.viewToModelX(localX)));
      model.setPlaybackTime(t);
    };
    const a11yStrings = StringManager.getInstance().getA11yStrings();
    chartRectangle.tagName = "div";
    chartRectangle.accessibleName = a11yStrings.timeCursorAccessibleNameStringProperty;
    model.recordingProperty.link((recording) => {
      chartRectangle.focusable = !(recording || model.noRecording);
    });
    chartRectangle.addInputListener(
      new RichDragListener({
        dragListenerOptions: {
          press: (event) => scrub(event.pointer.point.x),
          drag: (event) => scrub(event.pointer.point.x),
        },
        keyboardDragListenerOptions: {
          keyboardDragDirection: "leftRight",
          dragSpeed: 200,
          shiftDragSpeed: 80,
          drag: (_event, listener) => {
            if (model.recordingProperty.value || model.noRecording) {
              return;
            }
            const max = model.furthestRecordedTimeProperty.value;
            const t = timeProperty.value + listener.modelDelta.x * SCRUB_PER_PX;
            model.setPlaybackTime(Math.max(0, Math.min(max, t)));
          },
        },
      }),
    );
    chartRectangle.cursor = "ew-resize";

    chartRectangle.addInputListener(
      new KeyboardListener({
        keys: ["home", "end"],
        fire: (_event, keysPressed) => {
          if (model.recordingProperty.value || model.noRecording) {
            return;
          }
          const max = model.furthestRecordedTimeProperty.value;
          model.setPlaybackTime(keysPressed === "home" ? 0 : max);
        },
      }),
    );

    // Refresh the line whenever the model series may have changed.
    model.movingMan.historyClearedEmitter.addListener(() => this.refresh());

    // Make sure the (initially-empty) line plot is positioned correctly.
    this.refresh();
  }

  /** Position the playback cursor at the current time under the current x transform. */
  private updateCursor(): void {
    const x = this.chartTransform.modelToViewX(this.timeProperty.value);
    this.cursorLine.x1 = x;
    this.cursorLine.x2 = x;
  }

  /**
   * Recompute the line-plot data set from the latest values in the series.
   * Called every frame by the screen view's step() — bamboo is fine with that.
   */
  public refresh(): void {
    const size = this.series.size();
    if (size === this.datasetSize) {
      return;
    }
    if (size < this.datasetSize) {
      // Series was cleared; re-sync all points from scratch.
      this.dataset.length = size;
      for (let i = 0; i < size; i++) {
        const point = this.series.getPoint(i);
        if (!point) {
          continue;
        }
        const existing = this.dataset[i];
        if (existing) {
          existing.x = point.time;
          existing.y = point.value;
        } else {
          this.dataset[i] = new Vector2(point.time, point.value);
        }
      }
    } else {
      // Series grew; only append the new tail.
      for (let i = this.datasetSize; i < size; i++) {
        const point = this.series.getPoint(i);
        if (point) {
          this.dataset.push(new Vector2(point.time, point.value));
        }
      }
    }
    this.datasetSize = size;
    this.linePlot.setDataSet(this.dataset);
  }

  /** Pixel width of the inner plot area (handy for siblings that want to align). */
  public get plotWidth(): number {
    return this.chartTransform.viewWidth;
  }

  /** A neat short label for tick values (e.g. avoid "-0", drop trailing zeros). */
  private static formatTickValue(value: number): string {
    const rounded = Math.round(value * 100) / 100;
    if (rounded === 0) {
      return "0";
    }
    return String(rounded);
  }
}
