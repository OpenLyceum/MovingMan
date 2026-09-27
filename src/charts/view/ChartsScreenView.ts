/**
 * ChartsScreenView.ts
 *
 * The "Charts" screen. A compact play area at the top, three quantity-vs-time charts
 * stacked below (each in a collapsible box with its own slider control and value-axis
 * zoom on the left), a shared time-axis zoom near the top-right, a record/playback
 * transport at the bottom, and Reset All in the bottom-right corner.
 *
 * On every frame we ask the bamboo chart nodes to refresh from the latest series
 * values; the cursor inside each chart follows the model time automatically.
 */

import { NumberProperty, type Property, type TReadOnlyProperty } from "scenerystack/axon";
import { Range } from "scenerystack/dot";
import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import { HBox, Node, type TColor, Text, VBox } from "scenerystack/scenery";
import { PhetFont, PlusMinusZoomButtonGroup, ResetAllButton } from "scenerystack/scenery-phet";
import { ScreenView, type ScreenViewOptions } from "scenerystack/sim";
import { AccordionBox } from "scenerystack/sun";
import type { Tandem } from "scenerystack/tandem";
import { FLAT_RESET_ALL_BUTTON_OPTIONS } from "../../common/MovingManButtonOptions.js";
import type { DataSeries } from "../../common/model/DataSeries.js";
import type { MovingManModel } from "../../common/model/MovingManModel.js";
import { ChartNode, type ZoomLevel } from "../../common/view/ChartNode.js";
import { FunctionComboBox } from "../../common/view/FunctionComboBox.js";
import { MovingManScreenSummaryContent } from "../../common/view/MovingManScreenSummaryContent.js";
import { addCollisionSounds } from "../../common/view/MovingManSounds.js";
import { PlayAreaNode } from "../../common/view/PlayAreaNode.js";
import { PlaybackControls } from "../../common/view/PlaybackControls.js";
import { VariableControl, type VariableControlKind } from "../../common/view/VariableControl.js";
import { WallsCheckbox } from "../../common/view/WallsCheckbox.js";
import { StringManager } from "../../i18n/StringManager.js";
import MovingManColors from "../../MovingManColors.js";
import MovingManConstants from "../../MovingManConstants.js";

const MARGIN = 10;

const PLAY_AREA_WIDTH = 890;
const PLAY_AREA_HEIGHT = 150;

const VARIABLE_CONTROL_SLIDER_WIDTH = 100;
const CHART_WIDTH = 700;
// Charts are a little shorter than the original 100 px so three collapsible rows plus
// their title bars still clear the playback transport at the bottom of the screen.
const CHART_HEIGHT = 86;
const ROW_SPACING = 6;
const ACCORDION_MIN_WIDTH = 890;
const EXPAND_BUTTON_SIDE_LENGTH = 18;

const ACCORDION_TITLE_FONT = new PhetFont({ size: 14, weight: "bold" });
const ZOOM_LABEL_FONT = new PhetFont(12);

export type ChartsScreenViewOptions = ScreenViewOptions & { tandem: Tandem };

type RowSpec = {
  kind: VariableControlKind;
  controlRange: Range;
  valueLevels: readonly ZoomLevel[];
  color: TColor;
  series: DataSeries;
  titleStringProperty: TReadOnlyProperty<string>;
  timeZoomLevelProperty: NumberProperty;
};

type Row = {
  node: Node;
  valueZoomLevelProperty: NumberProperty;
  expandedProperty: Property<boolean>;
};

export class ChartsScreenView extends ScreenView {
  private readonly chartNodes: ChartNode[] = [];

  public constructor(model: MovingManModel, providedOptions: ChartsScreenViewOptions) {
    const options = optionize<ChartsScreenViewOptions, EmptySelfOptions, ScreenViewOptions>()(
      {
        screenSummaryContent: new MovingManScreenSummaryContent(model),
      },
      providedOptions,
    );
    super(options);

    // This screen view is permanent for the sim's lifetime; declare that so the collision-sound
    // emitter listener and per-chart links registered here are not read as unmanaged leaks.
    this.isDisposable = false;

    const layoutBounds = this.layoutBounds;
    const quantities = StringManager.getInstance().getQuantityStrings();
    const chartStrings = StringManager.getInstance().getChartStrings();

    addCollisionSounds(model.movingMan.collideEmitter);

    const playArea = new PlayAreaNode(model, { width: PLAY_AREA_WIDTH, height: PLAY_AREA_HEIGHT, compact: true });
    const wallsCheckbox = new WallsCheckbox(model);

    // Shared time (x) axis zoom level, applied to all three charts at once.
    const timeZoomLevelProperty = new NumberProperty(0, {
      range: new Range(0, MovingManConstants.TIME_ZOOM_LEVELS.length - 1),
    });

    const positionRow = this.makeRow(model, {
      kind: "position",
      controlRange: MovingManConstants.POSITION_RANGE,
      valueLevels: MovingManConstants.POSITION_ZOOM_LEVELS,
      color: MovingManColors.positionProperty,
      series: model.movingMan.positionGraphSeries,
      titleStringProperty: quantities.positionStringProperty,
      timeZoomLevelProperty,
    });
    const velocityRow = this.makeRow(model, {
      kind: "velocity",
      controlRange: MovingManConstants.VELOCITY_RANGE,
      valueLevels: MovingManConstants.VELOCITY_ZOOM_LEVELS,
      color: MovingManColors.velocityProperty,
      series: model.movingMan.velocityGraphSeries,
      titleStringProperty: quantities.velocityStringProperty,
      timeZoomLevelProperty,
    });
    const accelerationRow = this.makeRow(model, {
      kind: "acceleration",
      controlRange: MovingManConstants.ACCELERATION_RANGE,
      valueLevels: MovingManConstants.ACCELERATION_ZOOM_LEVELS,
      color: MovingManColors.accelerationProperty,
      series: model.movingMan.accelerationGraphSeries,
      titleStringProperty: quantities.accelerationStringProperty,
      timeZoomLevelProperty,
    });
    const rows = [positionRow, velocityRow, accelerationRow];

    const chartsColumn = new VBox({
      spacing: ROW_SPACING,
      align: "left",
      children: rows.map((row) => row.node),
    });

    // Shared time-axis zoom control, near the top-right (below the walls checkbox).
    const timeZoomGroup = new PlusMinusZoomButtonGroup(timeZoomLevelProperty, {
      orientation: "horizontal",
      spacing: 4,
    });
    const timeZoomBox = new HBox({
      spacing: 6,
      children: [
        new Text(chartStrings.timeStringProperty, {
          font: ZOOM_LABEL_FONT,
          fill: MovingManColors.foregroundColorProperty,
        }),
        timeZoomGroup,
      ],
    });

    const playbackControls = new PlaybackControls(model);

    // Preset position function chooser, bottom-left; its list opens upward.
    const comboListParent = new Node();
    const functionComboBox = new FunctionComboBox(model, comboListParent, "above");

    const resetView = (): void => {
      timeZoomLevelProperty.reset();
      for (const row of rows) {
        row.valueZoomLevelProperty.reset();
        row.expandedProperty.value = true;
      }
    };

    const resetAllButton = new ResetAllButton({
      ...FLAT_RESET_ALL_BUTTON_OPTIONS,
      listener: () => {
        this.interruptSubtreeInput();
        model.reset();
        resetView();
      },
      tandem: providedOptions.tandem.createTandem("resetAllButton"),
      accessibleName: StringManager.getInstance().getA11yStrings().resetAllStringProperty,
    });

    // ── Layout ───────────────────────────────────────────────────────────────
    playArea.left = layoutBounds.minX + MARGIN;
    playArea.top = layoutBounds.minY + MARGIN;

    wallsCheckbox.right = layoutBounds.maxX - MARGIN;
    wallsCheckbox.top = layoutBounds.minY + MARGIN;

    timeZoomBox.right = layoutBounds.maxX - MARGIN;
    timeZoomBox.top = wallsCheckbox.bottom + 12;

    chartsColumn.left = layoutBounds.minX + MARGIN;
    chartsColumn.top = playArea.bottom + MARGIN;

    playbackControls.centerX = layoutBounds.centerX - 60;
    playbackControls.bottom = layoutBounds.maxY - MARGIN;

    functionComboBox.left = layoutBounds.minX + MARGIN;
    functionComboBox.bottom = layoutBounds.maxY - MARGIN;

    resetAllButton.right = layoutBounds.maxX - MARGIN;
    resetAllButton.bottom = layoutBounds.maxY - MARGIN;

    this.children = [
      playArea,
      wallsCheckbox,
      timeZoomBox,
      chartsColumn,
      functionComboBox,
      playbackControls,
      resetAllButton,
      comboListParent,
    ];

    // Explicit traversal order for keyboard/screen-reader users. ScreenView forbids setting
    // pdomOrder on itself; instead we place nodes under the standard play-area and control-area
    // sections so the heading structure stays consistent. The simulation content (the man and
    // the chart rows) goes in the play area; the wall/zoom options, the function chooser, the
    // playback transport, and Reset All go in the control area. (comboListParent is just the
    // popup layer for functionComboBox.)
    this.pdomPlayAreaNode.pdomOrder = [playArea, chartsColumn];
    this.pdomControlAreaNode.pdomOrder = [
      wallsCheckbox,
      timeZoomBox,
      functionComboBox,
      playbackControls,
      resetAllButton,
    ];
  }

  private makeRow(model: MovingManModel, spec: RowSpec): Row {
    const control = new VariableControl(model, {
      kind: spec.kind,
      range: spec.controlRange,
      sliderWidth: VARIABLE_CONTROL_SLIDER_WIDTH,
      decimalPlaces: spec.kind === "acceleration" ? 1 : 2,
    });

    // Per-chart value (y) axis zoom.
    const valueZoomLevelProperty = new NumberProperty(0, {
      range: new Range(0, spec.valueLevels.length - 1),
    });
    const valueZoomGroup = new PlusMinusZoomButtonGroup(valueZoomLevelProperty, {
      orientation: "vertical",
      spacing: 4,
    });

    const chart = new ChartNode(model, model.timeProperty, {
      series: spec.series,
      color: spec.color,
      valueZoomLevelProperty,
      valueLevels: spec.valueLevels,
      timeZoomLevelProperty: spec.timeZoomLevelProperty,
      timeLevels: MovingManConstants.TIME_ZOOM_LEVELS,
      width: CHART_WIDTH,
      height: CHART_HEIGHT,
    });
    this.chartNodes.push(chart);

    const rowContent = new HBox({ spacing: 8, align: "center", children: [control, valueZoomGroup, chart] });

    const accordionBox = new AccordionBox(rowContent, {
      titleNode: new Text(spec.titleStringProperty, { font: ACCORDION_TITLE_FONT, fill: spec.color }),
      titleAlignX: "left",
      expandedDefaultValue: true,
      fill: MovingManColors.panelFillProperty,
      stroke: MovingManColors.panelStrokeProperty,
      cornerRadius: 6,
      contentXMargin: 8,
      contentYMargin: 4,
      expandCollapseButtonOptions: { sideLength: EXPAND_BUTTON_SIDE_LENGTH },
      minWidth: ACCORDION_MIN_WIDTH,
      // Collapse to just the title bar so the VBox reclaims the freed vertical space,
      // matching the original sim's collapsible rows.
      useExpandedBoundsWhenCollapsed: false,
    });

    return { node: accordionBox, valueZoomLevelProperty, expandedProperty: accordionBox.expandedProperty };
  }

  public override step(dt: number): void {
    super.step(dt);
    // Refresh the line plots from the latest model series.
    for (const chart of this.chartNodes) {
      chart.refresh();
    }
  }
}
