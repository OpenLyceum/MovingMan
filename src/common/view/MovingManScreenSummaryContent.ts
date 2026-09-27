/**
 * MovingManScreenSummaryContent.ts
 *
 * Accessible screen summary (SceneryStack Interactive Description) shared by both
 * Moving Man screens. Describes the play area and controls, gives an interaction
 * hint, and exposes a LIVE "current details" paragraph derived from the model
 * (the man's position, velocity, acceleration, and playback state).
 *
 * Follows the OpenLyceum accessibility convention; see the canonical
 * SceneryStackTemplate/SimScreenSummaryContent.ts.
 */

import { DerivedProperty } from "scenerystack/axon";
import { toFixed } from "scenerystack/dot";
import { StringUtils } from "scenerystack/phetcommon";
import { ScreenSummaryContent } from "scenerystack/sim";
import { StringManager } from "../../i18n/StringManager.js";
import type { MovingManModel } from "../model/MovingManModel.js";

export class MovingManScreenSummaryContent extends ScreenSummaryContent {
  public constructor(model: MovingManModel) {
    const a11y = StringManager.getInstance().getA11yStrings();

    const currentDetailsProperty = new DerivedProperty(
      [
        a11y.currentDetailsStringProperty,
        a11y.playingLabelStringProperty,
        a11y.pausedLabelStringProperty,
        model.movingMan.positionProperty,
        model.movingMan.velocityProperty,
        model.movingMan.accelerationProperty,
        model.isPlayingProperty,
      ],
      (template, playingLabel, pausedLabel, position, velocity, acceleration, isPlaying) =>
        StringUtils.fillIn(template, {
          position: toFixed(position, 1),
          velocity: toFixed(velocity, 1),
          acceleration: toFixed(acceleration, 1),
          state: isPlaying ? playingLabel : pausedLabel,
        }),
    );

    super({
      playAreaContent: a11y.screenSummary.playAreaStringProperty,
      controlAreaContent: a11y.screenSummary.controlAreaStringProperty,
      currentDetailsContent: currentDetailsProperty,
      interactionHintContent: a11y.screenSummary.interactionHintStringProperty,
    });
  }
}
