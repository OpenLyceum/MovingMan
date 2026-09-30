/**
 * StringManager.ts
 *
 * Centralizes string management for Moving Man.
 * Provides access to localized strings for all components.
 */

import type { ReadOnlyProperty } from "scenerystack/axon";
import { LocalizedString } from "scenerystack/chipper";
import stringsEn from "./strings_en.json";
import stringsEs from "./strings_es.json";
import stringsFr from "./strings_fr.json";

// ── Compile-time key-parity check ─────────────────────────────────────────────
// satisfies errors immediately if any locale file is missing keys from another. All three
// shipped locales (en/fr/es) are mutually checked so none can silently drift.
// biome-ignore lint/complexity/noVoid: intentional compile-time type assertion
void (stringsEn satisfies typeof stringsFr);
// biome-ignore lint/complexity/noVoid: intentional compile-time type assertion
void (stringsFr satisfies typeof stringsEn);
// biome-ignore lint/complexity/noVoid: intentional compile-time type assertion
void (stringsEn satisfies typeof stringsEs);
// biome-ignore lint/complexity/noVoid: intentional compile-time type assertion
void (stringsEs satisfies typeof stringsEn);

// ── Build the reactive string property tree ───────────────────────────────────
const stringProperties = LocalizedString.getNestedStringProperties({
  en: stringsEn,
  fr: stringsFr,
  es: stringsEs,
});

export class StringManager {
  private static instance: StringManager | null = null;

  private constructor() {
    // Private — obtain via getInstance()
  }

  public static getInstance(): StringManager {
    if (StringManager.instance === null) {
      StringManager.instance = new StringManager();
    }
    return StringManager.instance;
  }

  public getTitleStringProperty(): ReadOnlyProperty<string> {
    return stringProperties.titleStringProperty;
  }

  public getScreenNames(): {
    introStringProperty: ReadOnlyProperty<string>;
    chartsStringProperty: ReadOnlyProperty<string>;
  } {
    return {
      introStringProperty: stringProperties.screens.introStringProperty,
      chartsStringProperty: stringProperties.screens.chartsStringProperty,
    };
  }

  public getQuantityStrings() {
    return stringProperties.quantities;
  }

  public getUnitStrings() {
    return stringProperties.units;
  }

  public getVectorStrings() {
    return stringProperties.vectors;
  }

  public getControlStrings() {
    return stringProperties.controls;
  }

  public getPlaybackStrings() {
    return stringProperties.playback;
  }

  public getClockStrings() {
    return stringProperties.clock;
  }

  public getChartStrings() {
    return stringProperties.chart;
  }

  public getPatternStrings() {
    return stringProperties.patterns;
  }

  public getA11yStrings() {
    return stringProperties.a11y;
  }

  public getKeyboardHelpStrings() {
    return stringProperties.keyboardHelp;
  }

  /** Simulation-specific preference labels shown in Preferences → Simulation. */
  public getPreferences() {
    return stringProperties.preferences;
  }

  /** Preset combo-box labels in the same order as FUNCTION_PRESETS. */
  public getPresetLabelProperties(): ReadOnlyProperty<string>[] {
    const p = stringProperties.controls.presets;
    return [
      p.linearStringProperty,
      p.quadraticStringProperty,
      p.sineStringProperty,
      p.cosineStringProperty,
      p.fastSineStringProperty,
      p.sqrtLinearStringProperty,
    ];
  }
}
