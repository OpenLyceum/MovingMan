/**
 * main.ts
 *
 * Entry point for the simulation. Initializes SceneryStack, creates the
 * screens, and starts the main event loop.
 *
 * !! CRITICAL IMPORT ORDER !!
 * brand.js MUST be the first import. Each module imports the next, so the import nesting is
 *
 *   main → brand → splash → assert → init
 *
 * and therefore the actual EXECUTION order (deepest import runs first) is the reverse:
 *
 *   init → assert → splash → brand → main
 *
 * SceneryStack requires this exact load order. Never reorder these imports.
 */

// brand.js MUST be first; importing it runs the whole chain (init→assert→splash→brand) before main.
import "./brand.js";

import { onReadyToLaunch, PreferencesModel, Sim } from "scenerystack/sim";
import { Tandem } from "scenerystack/tandem";
import { ChartsScreen } from "./charts/ChartsScreen.js";
import { StringManager } from "./i18n/StringManager.js";
import { IntroScreen } from "./intro/IntroScreen.js";
import MovingManColors from "./MovingManColors.js";
import { MovingManPreferencesModel } from "./preferences/MovingManPreferencesModel.js";
import { MovingManPreferencesNode } from "./preferences/MovingManPreferencesNode.js";

onReadyToLaunch(() => {
  const stringManager = StringManager.getInstance();
  const screenNames = stringManager.getScreenNames();

  // Simulation-specific preferences; initial values come from movingManQueryParameters.
  const movingManPreferences = new MovingManPreferencesModel(Tandem.ROOT.createTandem("preferences"));

  const screens = [
    new IntroScreen({
      preferences: movingManPreferences,
      // The screen name Property updates automatically when the locale changes
      name: screenNames.introStringProperty,
      tandem: Tandem.ROOT.createTandem("introScreen"),
      backgroundColorProperty: MovingManColors.backgroundColorProperty,
    }),
    new ChartsScreen({
      preferences: movingManPreferences,
      // The screen name Property updates automatically when the locale changes
      name: screenNames.chartsStringProperty,
      tandem: Tandem.ROOT.createTandem("chartsScreen"),
      backgroundColorProperty: MovingManColors.backgroundColorProperty,
    }),
  ];

  const sim = new Sim(stringManager.getTitleStringProperty(), screens, {
    preferencesModel: new PreferencesModel({
      visualOptions: {
        // Adds a "Projector Mode" toggle in Preferences → Visual
        supportsProjectorMode: true,
        // Enables keyboard-navigation highlight outlines
        supportsInteractiveHighlights: true,
      },
      simulationOptions: {
        customPreferences: [
          {
            createContent: (tandem: Tandem) => new MovingManPreferencesNode(movingManPreferences, tandem),
          },
        ],
      },
      localizationOptions: {
        // Adds a language picker in Preferences → Language
        supportsDynamicLocale: true,
      },
      audioOptions: {
        // Initializes tambo and the Audio preferences. Pair with supportsSound in src/init.ts.
        supportsSound: true,
      },
    }),
  });
  sim.start();
});
