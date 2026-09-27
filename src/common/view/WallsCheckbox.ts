/**
 * WallsCheckbox.ts
 *
 * The "Walls" toggle. Placed near the play area on both screens.
 */

import { type Node, Text } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { Checkbox, Panel } from "scenerystack/sun";
import { StringManager } from "../../i18n/StringManager.js";
import MovingManColors from "../../MovingManColors.js";
import type { MovingManModel } from "../model/MovingManModel.js";

const LABEL_FONT = new PhetFont(13);

export class WallsCheckbox extends Panel {
  public constructor(model: MovingManModel) {
    const label: Node = new Text(StringManager.getInstance().getControlStrings().wallsStringProperty, {
      font: LABEL_FONT,
      fill: MovingManColors.foregroundColorProperty,
    });
    const a11y = StringManager.getInstance().getA11yStrings();
    const checkbox = new Checkbox(model.wallsEnabledProperty, label, {
      boxWidth: 16,
      checkboxColor: MovingManColors.foregroundColorProperty,
      checkboxColorBackground: MovingManColors.panelFillProperty,
      accessibleName: a11y.wallsCheckboxStringProperty,
    });
    super(checkbox, {
      fill: MovingManColors.panelFillProperty,
      stroke: MovingManColors.panelStrokeProperty,
      cornerRadius: 6,
      xMargin: 8,
      yMargin: 6,
      // Permanent per-screen control; never disposed (consistent with the other view panels).
      isDisposable: false,
    });
  }
}
