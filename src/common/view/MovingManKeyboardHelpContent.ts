/**
 * MovingManKeyboardHelpContent.ts
 *
 * Content for the keyboard-help dialog (the "?" button in the navigation bar).
 * Both screens share the same interaction model — sliders for position/velocity/
 * acceleration, the x(t) function combo box, and checkboxes/buttons — so a single
 * layout is reused for both.
 */

import {
  BasicActionsKeyboardHelpSection,
  ComboBoxKeyboardHelpSection,
  SliderControlsKeyboardHelpSection,
  TwoColumnKeyboardHelpContent,
} from "scenerystack/scenery-phet";

export class MovingManKeyboardHelpContent extends TwoColumnKeyboardHelpContent {
  public constructor() {
    const leftSections = [
      // Adjusting the position / velocity / acceleration sliders.
      new SliderControlsKeyboardHelpSection(),
      // Choosing a preset from the x(t) function combo box.
      new ComboBoxKeyboardHelpSection(),
    ];

    const rightSections = [
      // Tab/button navigation plus the walls and vector checkboxes.
      new BasicActionsKeyboardHelpSection({ withCheckboxContent: true }),
    ];

    super(leftSections, rightSections);
  }
}
