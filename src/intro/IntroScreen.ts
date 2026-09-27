import { type EmptySelfOptions, optionize } from "scenerystack/phet-core";
import { Screen, type ScreenOptions } from "scenerystack/sim";
import type { Tandem } from "scenerystack/tandem";
import { createIntroIcon } from "../common/MovingManScreenIcons.js";
import { MovingManModel } from "../common/model/MovingManModel.js";
import { MovingManKeyboardHelpContent } from "../common/view/MovingManKeyboardHelpContent.js";
import type { MovingManPreferencesModel } from "../preferences/MovingManPreferencesModel.js";
import { IntroScreenView } from "./view/IntroScreenView.js";

type IntroScreenOptions = ScreenOptions & { tandem: Tandem; preferences: MovingManPreferencesModel };

export class IntroScreen extends Screen<MovingManModel, IntroScreenView> {
  public constructor(options: IntroScreenOptions) {
    super(
      () => new MovingManModel({ noRecording: true, preferences: options.preferences }),
      (model) => new IntroScreenView(model, { tandem: options.tandem.createTandem("view") }),
      optionize<IntroScreenOptions, EmptySelfOptions, ScreenOptions>()(
        {
          homeScreenIcon: createIntroIcon(),
          navigationBarIcon: createIntroIcon(),
          createKeyboardHelpNode: () => new MovingManKeyboardHelpContent(),
        },
        options,
      ),
    );
  }
}
