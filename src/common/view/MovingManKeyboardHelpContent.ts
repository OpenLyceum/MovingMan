/**
 * MovingManKeyboardHelpContent.ts
 *
 * Content for the keyboard-help dialog (the "?" button in the navigation bar).
 * Both screens share the same interaction model — sliders, the x(t) combo box,
 * and keyboard-dragging the man left and right (MovingManSpriteNode).
 * MoveDraggableItemsKeyboardHelpSection also documents up/down and W/S, which
 * that listener does not bind, so the man section uses the left/right key
 * strings KeyboardDragListener actually registers. No second listener is added.
 */

import { HotkeyData } from "scenerystack/scenery";
import {
  BasicActionsKeyboardHelpSection,
  ComboBoxKeyboardHelpSection,
  KeyboardHelpSection,
  KeyboardHelpSectionRow,
  SliderControlsKeyboardHelpSection,
  TwoColumnKeyboardHelpContent,
} from "scenerystack/scenery-phet";
import { StringManager } from "../../i18n/StringManager.js";

const keyboardHelpStrings = StringManager.getInstance().getKeyboardHelpStrings();

// Matches KeyboardDragListener's left/right key strings (shift is an ignored modifier).
const manMoveHotkeyData = new HotkeyData({
  keys: ["shift?+arrowLeft", "shift?+arrowRight", "shift?+a", "shift?+d"],
  repoName: "movingman",
  keyboardHelpDialogLabelStringProperty: keyboardHelpStrings.moveStringProperty,
  keyboardHelpDialogPDOMLabelStringProperty: keyboardHelpStrings.moveDescriptionStringProperty,
});

// Shift changes drag speed inside that same listener; this row only documents it.
const manSlowerHotkeyData = new HotkeyData({
  keys: ["shift+arrowLeft", "shift+arrowRight", "shift+a", "shift+d"],
  repoName: "movingman",
  keyboardHelpDialogLabelStringProperty: keyboardHelpStrings.moveSlowerStringProperty,
  keyboardHelpDialogPDOMLabelStringProperty: keyboardHelpStrings.moveSlowerDescriptionStringProperty,
});

export class MovingManKeyboardHelpContent extends TwoColumnKeyboardHelpContent {
  public constructor() {
    const man = new KeyboardHelpSection(keyboardHelpStrings.manHeadingStringProperty, [
      KeyboardHelpSectionRow.fromHotkeyData(manMoveHotkeyData),
      KeyboardHelpSectionRow.fromHotkeyData(manSlowerHotkeyData),
    ]);

    const leftSections = [new SliderControlsKeyboardHelpSection(), new ComboBoxKeyboardHelpSection(), man];

    const rightSections = [new BasicActionsKeyboardHelpSection({ withCheckboxContent: true })];

    super(leftSections, rightSections);
  }
}
