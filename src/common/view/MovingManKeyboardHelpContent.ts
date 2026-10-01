/**
 * MovingManKeyboardHelpContent.ts
 *
 * Content for the keyboard-help dialog (the "?" button in the navigation bar).
 * Both screens share the same interaction model — sliders, the x(t) combo box,
 * and keyboard-dragging the man left and right (MovingManSpriteNode).
 * MoveDraggableItemsKeyboardHelpSection also documents up/down and W/S, which
 * that listener does not bind, so the man section uses the left/right key
 * strings KeyboardDragListener actually registers. No second listener is added.
 * The Charts screen adds a section for the graph time cursor (ChartNode): left/right
 * scrub through the recording, Home/End jump to its start and end.
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

// Matches the chart's KeyboardDragListener (left/right) and KeyboardListener (home/end).
const chartScrubHotkeyData = new HotkeyData({
  keys: ["arrowLeft", "arrowRight", "a", "d"],
  repoName: "movingman",
  keyboardHelpDialogLabelStringProperty: keyboardHelpStrings.scrubStringProperty,
  keyboardHelpDialogPDOMLabelStringProperty: keyboardHelpStrings.scrubDescriptionStringProperty,
});

const chartJumpHotkeyData = new HotkeyData({
  keys: ["home", "end"],
  repoName: "movingman",
  keyboardHelpDialogLabelStringProperty: keyboardHelpStrings.jumpToStartEndStringProperty,
  keyboardHelpDialogPDOMLabelStringProperty: keyboardHelpStrings.jumpToStartEndDescriptionStringProperty,
});

export type MovingManKeyboardHelpContentOptions = {
  /** Include the graph time-cursor section (Charts screen only). */
  includeChartCursor?: boolean;
};

export class MovingManKeyboardHelpContent extends TwoColumnKeyboardHelpContent {
  public constructor(options?: MovingManKeyboardHelpContentOptions) {
    const man = new KeyboardHelpSection(keyboardHelpStrings.manHeadingStringProperty, [
      KeyboardHelpSectionRow.fromHotkeyData(manMoveHotkeyData),
      KeyboardHelpSectionRow.fromHotkeyData(manSlowerHotkeyData),
    ]);

    const leftSections = [new SliderControlsKeyboardHelpSection(), new ComboBoxKeyboardHelpSection(), man];

    const rightSections: KeyboardHelpSection[] = [];
    if (options?.includeChartCursor) {
      rightSections.push(
        new KeyboardHelpSection(keyboardHelpStrings.chartHeadingStringProperty, [
          KeyboardHelpSectionRow.fromHotkeyData(chartScrubHotkeyData),
          KeyboardHelpSectionRow.fromHotkeyData(chartJumpHotkeyData),
        ]),
      );
    }
    rightSections.push(new BasicActionsKeyboardHelpSection({ withCheckboxContent: true }));

    super(leftSections, rightSections);
  }
}
