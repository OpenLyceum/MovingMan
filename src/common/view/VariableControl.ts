/**
 * VariableControl.ts
 *
 * A control row for one of the three kinematic quantities. Combines:
 *   - a title in the variable's color (bolded when this is the driving quantity),
 *   - a NumberControl (slider + number display + arrow buttons) for direct manipulation,
 *   - and, for velocity and acceleration, a checkbox toggling the on-man vector arrow.
 *
 * Picking up the slider, typing in the display, or tapping the arrow buttons all set
 * the corresponding driving quantity ("position-driven", etc.) on the man, matching
 * the behavior of the original simulation.
 */

import type { Property, TReadOnlyProperty } from "scenerystack/axon";
import { BooleanProperty, NumberProperty, PatternStringProperty, StringProperty } from "scenerystack/axon";
import { clamp, Dimension2, type Range } from "scenerystack/dot";
import { type AlignGroup, HBox, type Node, type TColor, Text, VBox, VStrut } from "scenerystack/scenery";
import { NumberControl, PhetFont } from "scenerystack/scenery-phet";
import { Checkbox, Panel } from "scenerystack/sun";
import { StringManager } from "../../i18n/StringManager.js";
import MovingManColors from "../../MovingManColors.js";
import { MotionStrategy } from "../model/MotionStrategy.js";
import type { MovingManModel } from "../model/MovingManModel.js";

const TITLE_FONT_SIZE = 14;
const TITLE_FONT_BOLD = new PhetFont({ size: TITLE_FONT_SIZE, weight: "bold" });
const TITLE_FONT_NORMAL = new PhetFont(TITLE_FONT_SIZE);
const LABEL_FONT = new PhetFont(12);
const PANEL_CORNER_RADIUS = 6;
const PANEL_X_MARGIN = 8;
const PANEL_Y_MARGIN = 6;
const PANEL_VSPACING = 4;
const PANEL_HSPACING = 10;
const NUMBER_CONTROL_DELTA = 0.1;

export type VariableControlKind = "position" | "velocity" | "acceleration";

/** Where the vector-visibility checkbox sits relative to the slider. */
export type VectorCheckboxPlacement = "below" | "right";

export type VariableControlOptions = {
  kind: VariableControlKind;
  range: Range;
  /** Slider track width in px. */
  sliderWidth?: number;
  /** Decimal places shown in the read-out. */
  decimalPlaces?: number;
  /**
   * Where the vector-visibility checkbox sits. "below" (default) keeps the panel narrow for
   * a horizontal row of controls; "right" keeps it short for a vertical stack of controls.
   */
  vectorCheckboxPlacement?: VectorCheckboxPlacement;
  /**
   * Optional group that pads each panel's content to a common size (left-aligned) so a stack
   * of panels shares one width and their sliders line up. Share one instance across the stack.
   */
  contentAlignGroup?: AlignGroup;
};

export class VariableControl extends Panel {
  public constructor(model: MovingManModel, options: VariableControlOptions) {
    const {
      kind,
      range,
      sliderWidth = 240,
      decimalPlaces = 2,
      vectorCheckboxPlacement = "below",
      contentAlignGroup,
    } = options;
    const bundle = VariableControl.resolveBundle(model, kind);

    // Title is "Quantity (units)", assembled from a localized pattern so the punctuation/order
    // around the unit can be translated. The PatternStringProperty rerenders when either the
    // quantity name, the unit, or the pattern itself changes locale.
    const patterns = StringManager.getInstance().getPatternStrings();
    const titleStringProperty = new PatternStringProperty(patterns.quantityWithUnitsStringProperty, {
      quantity: bundle.titleStringProperty,
      units: bundle.unitStringProperty,
    });
    const titleText = new Text(titleStringProperty, { font: TITLE_FONT_NORMAL, fill: bundle.color });

    // ── Two-property "lock" pattern ──────────────────────────────────────────
    // The NumberControl is bidirectionally bound to a clamped controlProperty so
    // the slider and display never go out of range. A flag tells the model→control
    // link to update silently (avoiding a feedback loop), and a flag on the
    // control→model link distinguishes user input from these silent updates.
    const controlProperty = new NumberProperty(clamp(bundle.modelProperty.value, range.min, range.max));
    let suppressModelUpdate = false;
    let suppressControlUpdate = false;

    bundle.modelProperty.link((value) => {
      if (suppressControlUpdate) {
        return;
      }
      suppressModelUpdate = true;
      controlProperty.value = clamp(value, range.min, range.max);
      suppressModelUpdate = false;
    });

    controlProperty.lazyLink((value) => {
      if (suppressModelUpdate) {
        return;
      }
      suppressControlUpdate = true;
      bundle.applyUserChange(value);
      suppressControlUpdate = false;
    });

    // Bold the title when this variable is currently driving the man.
    model.movingMan.motionStrategyProperty.link((strategy) => {
      titleText.font = strategy === bundle.strategy ? TITLE_FONT_BOLD : TITLE_FONT_NORMAL;
    });

    const a11y = StringManager.getInstance().getA11yStrings();
    const controlAccessibleName =
      kind === "position"
        ? a11y.positionControlStringProperty
        : kind === "velocity"
          ? a11y.velocityControlStringProperty
          : a11y.accelerationControlStringProperty;

    const numberControl = new NumberControl(titleText, controlProperty, range, {
      delta: NUMBER_CONTROL_DELTA,
      layoutFunction: NumberControl.createLayoutFunction1({
        align: "center",
        ySpacing: 2,
      }),
      numberDisplayOptions: {
        decimalPlaces,
        textOptions: { font: LABEL_FONT },
      },
      sliderOptions: {
        trackSize: new Dimension2(sliderWidth, 4),
        thumbSize: new Dimension2(14, 22),
      },
      titleNodeOptions: { font: TITLE_FONT_NORMAL },
      accessibleName: controlAccessibleName,
    });

    // While a preset function drives position, the position control is read-only
    // (matching the original sim, which disabled the position slider in function mode).
    if (kind === "position") {
      model.movingMan.functionProperty.link((preset) => {
        numberControl.enabledProperty.value = preset === null;
      });
    }

    const checkbox =
      bundle.vectorVisibleProperty && bundle.vectorLabelStringProperty
        ? VariableControl.makeVectorCheckbox(bundle.vectorVisibleProperty, bundle.vectorLabelStringProperty)
        : null;

    let content: Node;
    if (vectorCheckboxPlacement === "right") {
      // Checkbox to the right of the slider, so a vertical stack of panels stays short.
      // Position has no checkbox; the align group (if any) pads it out to the shared width.
      content = new HBox({
        align: "center",
        spacing: PANEL_HSPACING,
        children: checkbox ? [numberControl, checkbox] : [numberControl],
      });
    } else {
      // Checkbox below the slider. Position reserves the checkbox-row height so every panel
      // in a horizontal row is the same height whether or not it has a checkbox.
      content = new VBox({
        align: "center",
        spacing: PANEL_VSPACING,
        children: [numberControl, checkbox ?? new VStrut(VariableControl.vectorCheckboxHeight())],
      });
    }

    const panelContent: Node = contentAlignGroup ? contentAlignGroup.createBox(content, { xAlign: "left" }) : content;

    super(panelContent, {
      fill: MovingManColors.panelFillProperty,
      stroke: MovingManColors.panelStrokeProperty,
      cornerRadius: PANEL_CORNER_RADIUS,
      xMargin: PANEL_X_MARGIN,
      yMargin: PANEL_Y_MARGIN,
      // This control lives for the lifetime of its screen and is never disposed; declare that
      // explicitly so the model-Property links above are not mistaken for an unmanaged leak.
      isDisposable: false,
    });
  }

  private static resolveBundle(
    model: MovingManModel,
    kind: VariableControlKind,
  ): {
    titleStringProperty: TReadOnlyProperty<string>;
    unitStringProperty: TReadOnlyProperty<string>;
    color: TColor;
    modelProperty: NumberProperty;
    strategy: MotionStrategy;
    vectorVisibleProperty: Property<boolean> | null;
    vectorLabelStringProperty: TReadOnlyProperty<string> | null;
    applyUserChange: (value: number) => void;
  } {
    const strings = StringManager.getInstance();
    const q = strings.getQuantityStrings();
    const u = strings.getUnitStrings();
    const v = strings.getVectorStrings();
    const man = model.movingMan;
    switch (kind) {
      case "position":
        return {
          titleStringProperty: q.positionStringProperty,
          unitStringProperty: u.positionStringProperty,
          color: MovingManColors.positionProperty,
          modelProperty: man.positionProperty,
          strategy: MotionStrategy.POSITION,
          vectorVisibleProperty: null,
          vectorLabelStringProperty: null,
          applyUserChange: (value) => {
            man.setPositionDriven();
            man.setMousePosition(value);
            man.positionProperty.value = value;
          },
        };
      case "velocity":
        return {
          titleStringProperty: q.velocityStringProperty,
          unitStringProperty: u.velocityStringProperty,
          color: MovingManColors.velocityProperty,
          modelProperty: man.velocityProperty,
          strategy: MotionStrategy.VELOCITY,
          vectorVisibleProperty: model.showVelocityVectorProperty,
          vectorLabelStringProperty: v.showVelocityStringProperty,
          applyUserChange: (value) => {
            man.setVelocityDriven();
            man.velocityProperty.value = value;
          },
        };
      case "acceleration":
        return {
          titleStringProperty: q.accelerationStringProperty,
          unitStringProperty: u.accelerationStringProperty,
          color: MovingManColors.accelerationProperty,
          modelProperty: man.accelerationProperty,
          strategy: MotionStrategy.ACCELERATION,
          vectorVisibleProperty: model.showAccelerationVectorProperty,
          vectorLabelStringProperty: v.showAccelerationStringProperty,
          applyUserChange: (value) => {
            man.setAccelerationDriven();
            man.accelerationProperty.value = value;
          },
        };
    }
  }

  private static makeVectorCheckbox(
    visibleProperty: Property<boolean>,
    labelStringProperty: TReadOnlyProperty<string>,
  ): Node {
    const label = new Text(labelStringProperty, { font: LABEL_FONT, fill: MovingManColors.foregroundColorProperty });
    return new Checkbox(visibleProperty, label, {
      boxWidth: 14,
      checkboxColor: MovingManColors.foregroundColorProperty,
      checkboxColorBackground: MovingManColors.panelFillProperty,
    });
  }

  // Height of a vector-checkbox row, measured once from a throwaway checkbox and reused to
  // pad the Position panel (which has no checkbox) to the same height as the others.
  private static cachedVectorCheckboxHeight: number | null = null;
  private static vectorCheckboxHeight(): number {
    if (VariableControl.cachedVectorCheckboxHeight === null) {
      const dummyVisibleProp = new BooleanProperty(false);
      const dummyLabelProp = new StringProperty("X");
      VariableControl.cachedVectorCheckboxHeight = VariableControl.makeVectorCheckbox(
        dummyVisibleProp,
        dummyLabelProp,
      ).height;
      dummyVisibleProp.dispose();
      dummyLabelProp.dispose();
    }
    return VariableControl.cachedVectorCheckboxHeight;
  }
}
