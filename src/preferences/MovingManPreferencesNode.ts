/**
 * MovingManPreferencesNode.ts
 *
 * Custom preferences UI shown in Preferences → Simulation. Controls are bound to
 * MovingManPreferencesModel Properties (initial values from query parameters).
 */

import { Text, VBox } from "scenerystack/scenery";
import { PhetFont } from "scenerystack/scenery-phet";
import { Checkbox } from "scenerystack/sun";
import type { Tandem } from "scenerystack/tandem";
import { StringManager } from "../i18n/StringManager.js";
import MovingManColors from "../MovingManColors.js";
import MovingManNamespace from "../MovingManNamespace.js";
import type { MovingManPreferencesModel } from "./MovingManPreferencesModel.js";

export class MovingManPreferencesNode extends VBox {
  public constructor(preferencesModel: MovingManPreferencesModel, tandem?: Tandem) {
    const prefStrings = StringManager.getInstance().getPreferences();

    // Preferences dialog is always white — use control-surface colors, not textColorProperty.
    const header = new Text(prefStrings.titleStringProperty, {
      font: new PhetFont({ size: 18, weight: "bold" }),
      fill: MovingManColors.controlSurfaceTextColorProperty,
    });

    const checkbox = (
      property: MovingManPreferencesModel["wallsEnabledProperty"],
      labelProperty: typeof prefStrings.wallsEnabledStringProperty,
      tandemName: string,
    ): Checkbox =>
      new Checkbox(
        property,
        new Text(labelProperty, {
          font: new PhetFont(14),
          fill: MovingManColors.controlSurfaceTextColorProperty,
        }),
        {
          spacing: 8,
          checkboxColor: MovingManColors.controlSurfaceTextColorProperty,
          checkboxColorBackground: MovingManColors.controlSurfaceColorProperty,
          ...(tandem && { tandem: tandem.createTandem(tandemName) }),
        },
      );

    super({
      align: "left",
      spacing: 12,
      children: [
        header,
        checkbox(preferencesModel.wallsEnabledProperty, prefStrings.wallsEnabledStringProperty, "wallsEnabledCheckbox"),
        checkbox(preferencesModel.elasticWallsProperty, prefStrings.elasticWallsStringProperty, "elasticWallsCheckbox"),
        checkbox(
          preferencesModel.showVelocityVectorProperty,
          prefStrings.showVelocityVectorStringProperty,
          "showVelocityVectorCheckbox",
        ),
        checkbox(
          preferencesModel.showAccelerationVectorProperty,
          prefStrings.showAccelerationVectorStringProperty,
          "showAccelerationVectorCheckbox",
        ),
      ],
    });
  }
}

MovingManNamespace.register("MovingManPreferencesNode", MovingManPreferencesNode);
