/**
 * speakValueOnFocus.ts
 *
 * Interactive-description helper: speak a live "object response" — the current value of a
 * draggable object — to screen readers whenever that value changes while the object holds
 * keyboard focus. Used for the man (his position) and the chart time cursor (the time).
 *
 * Pointer drags do not move DOM focus, so mouse users hear nothing (they can see the
 * value). Rapid changes are collapsed to the final value by the utterance's
 * `alertStableDelay`, so continuous motion is announced once it settles.
 * (Same pattern as BasicCoordinatesAndSeasons.)
 */

import type { TReadOnlyProperty } from "scenerystack/axon";
import type { Node } from "scenerystack/scenery";
import { Utterance } from "scenerystack/utterance-queue";

/** Debounce (ms) so a burst of changes announces once, with the final value. */
const ALERT_STABLE_DELAY = 500;

/**
 * Announce `responseProperty` as an object response on `node` each time it changes
 * while `node` is focused.
 *
 * @param node - the focusable draggable object
 * @param responseProperty - a localized string describing the object's current value
 */
export function speakValueOnFocus(node: Node, responseProperty: TReadOnlyProperty<string>): void {
  const utterance = new Utterance({ alert: responseProperty, alertStableDelay: ALERT_STABLE_DELAY });
  responseProperty.lazyLink(() => {
    if (node.focused) {
      node.addAccessibleObjectResponse(utterance);
    }
  });
}
