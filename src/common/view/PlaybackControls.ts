/**
 * PlaybackControls.ts
 *
 * The bottom-of-screen transport for the Charts screen: a Record/Playback radio, a
 * rewind-to-start button, the standard play/pause + step + Slow/Normal/Fast speed control
 * (scenery-phet's TimeControlNode), and an eraser button that clears the recording.
 * (Reset All lives in the screen view.)
 */

import { EnumerationProperty, Property, type TReadOnlyProperty } from "scenerystack/axon";
import { HBox, type Node, Text } from "scenerystack/scenery";
import { EraserButton, PhetFont, RestartButton, TimeControlNode, TimeSpeed } from "scenerystack/scenery-phet";
import { AquaRadioButtonGroup } from "scenerystack/sun";
import { Tandem } from "scenerystack/tandem";
import { StringManager } from "../../i18n/StringManager.js";
import MovingManColors from "../../MovingManColors.js";
import type { MovingManModel } from "../model/MovingManModel.js";

const LABEL_FONT = new PhetFont(13);

// Matches TimeSpeedRadioButtonGroup's vertical spacing so the two stacked groups line up.
const RADIO_BUTTON_SPACING = 9;
const RADIO_BUTTON_RADIUS = 8;
const TRANSPORT_BUTTON_RADIUS = 16;
const PLAY_PAUSE_BUTTON_RADIUS = 20;
const CONTROLS_SPACING = 20;
// Spacing between the rewind button and the standard play/pause + step group, matched to
// the group's own internal button spacing so the whole transport reads as one cluster.
const TRANSPORT_SPACING = 10;

// Discrete playback speeds behind the Slow / Normal / Fast radio buttons. The model's
// playbackSpeedProperty stays the source of truth (Reset All resets it to Normal = 1).
const SPEED_VALUE = new Map<TimeSpeed, number>([
  [TimeSpeed.SLOW, 0.5],
  [TimeSpeed.NORMAL, 1],
  [TimeSpeed.FAST, 2],
]);

function valueToSpeed(value: number): TimeSpeed {
  if (value <= 0.75) {
    return TimeSpeed.SLOW;
  }
  if (value >= 1.5) {
    return TimeSpeed.FAST;
  }
  return TimeSpeed.NORMAL;
}

function labelText(stringProperty: TReadOnlyProperty<string>): Node {
  return new Text(stringProperty, { font: LABEL_FONT, fill: MovingManColors.foregroundColorProperty });
}

export class PlaybackControls extends HBox {
  public constructor(model: MovingManModel) {
    const playback = StringManager.getInstance().getPlaybackStrings();
    const a11y = StringManager.getInstance().getA11yStrings();

    // ── Record / Playback radio bound to a side-effecting wrapper property ────
    // We can't bind the radio directly to recordingProperty because flipping it must
    // also run model.record() / model.stopRecording() (they pause and clear).
    const recordingChoiceProperty = new Property<boolean>(model.recordingProperty.value);
    model.recordingProperty.link((recording) => {
      recordingChoiceProperty.value = recording;
    });
    recordingChoiceProperty.lazyLink((choice) => {
      if (choice === model.recordingProperty.value) {
        return;
      }
      if (choice) {
        model.record();
      } else {
        model.stopRecording();
      }
    });

    const recordPlaybackGroup = new AquaRadioButtonGroup<boolean>(
      recordingChoiceProperty,
      [
        { value: true, createNode: () => labelText(playback.recordStringProperty) },
        { value: false, createNode: () => labelText(playback.playbackStringProperty) },
      ],
      {
        orientation: "vertical",
        spacing: RADIO_BUTTON_SPACING,
        radioButtonOptions: { radius: RADIO_BUTTON_RADIUS, stroke: MovingManColors.foregroundColorProperty },
        accessibleName: a11y.recordModeAccessibleNameStringProperty,
      },
    );

    // ── Slow / Normal / Fast, mirrored to/from the model's continuous speed Property ──
    const timeSpeedProperty = new EnumerationProperty(valueToSpeed(model.playbackSpeedProperty.value));
    timeSpeedProperty.link((speed) => {
      model.playbackSpeedProperty.value = SPEED_VALUE.get(speed) ?? 1;
    });
    model.playbackSpeedProperty.link((value) => {
      timeSpeedProperty.value = valueToSpeed(value);
    });

    // Rewind to t = 0.
    const rewindButton = new RestartButton({
      radius: TRANSPORT_BUTTON_RADIUS,
      listener: () => model.rewind(),
    });

    // Standard play/pause + step + speed radio (handles grouping and spacing for us).
    const timeControlNode = new TimeControlNode(model.isPlayingProperty, {
      timeSpeedProperty,
      timeSpeeds: [TimeSpeed.SLOW, TimeSpeed.NORMAL, TimeSpeed.FAST],
      flowBoxSpacing: 16,
      playPauseStepButtonOptions: {
        playPauseStepXSpacing: TRANSPORT_SPACING,
        playPauseButtonOptions: {
          radius: PLAY_PAUSE_BUTTON_RADIUS,
          startPlayingAccessibleName: a11y.playPauseStartStringProperty,
          endPlayingAccessibleName: a11y.playPauseEndStringProperty,
        },
        // The step-forward button is enabled only while paused (the group's default).
        stepForwardButtonOptions: {
          radius: TRANSPORT_BUTTON_RADIUS,
          listener: () => model.stepOnce(),
          accessibleName: a11y.stepForwardStringProperty,
        },
      },
      tandem: Tandem.OPT_OUT,
    });

    // Clear all recorded data.
    const eraserButton = new EraserButton({
      listener: () => model.clear(),
    });

    // Keep the rewind button tight against the standard transport group.
    const transport = new HBox({
      spacing: TRANSPORT_SPACING,
      align: "center",
      children: [rewindButton, timeControlNode],
    });

    super({
      spacing: CONTROLS_SPACING,
      align: "center",
      children: [recordPlaybackGroup, transport, eraserButton],
      // Permanent per-screen transport; never disposed, so the model mirror links above are
      // lifetime-scoped by design rather than an unmanaged leak.
      isDisposable: false,
    });
  }
}
