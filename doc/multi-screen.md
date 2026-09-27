# Multi-Screen Simulations

Moving Man is a **two-screen** kinematics sim. Both screens use
`MovingManModel` with different construction options and share
`MovingManPreferencesModel`. Icons are set in each `*Screen.ts`.

For pedagogy and architecture, see [model.md](./model.md) and
[implementation-notes.md](./implementation-notes.md).

---

## Screens in this sim

| Order | UI name | Folder | Screen class | Icon factory |
|---|---|---|---|---|
| 1 | Introduction | `src/intro/` | `IntroScreen` | `createIntroIcon()` |
| 2 | Charts | `src/charts/` | `ChartsScreen` | `createChartsIcon()` |

```
main.ts
  ├─ IntroScreen   → MovingManModel({ noRecording: true, preferences })
  │                   / IntroScreenView
  └─ ChartsScreen  → MovingManModel({ preferences })
                      / ChartsScreenView
```

Each screen folder holds its Screen and ScreenView; the model and every view
component both screens use live in `src/common/model/` and `src/common/view/`.
Each screen creates its **own** `MovingManModel` instance — Intro disables
recording via `noRecording: true`.

---

## Folder layout

```
src/
├─ common/
│   └─ MovingManScreenIcons.ts
│   ├─ model/MovingManModel.ts …
│   └─ view/  PlayAreaNode.ts, ChartNode.ts, MovingManKeyboardHelpContent.ts …
├─ intro/   IntroScreen.ts, view/IntroScreenView.ts
├─ charts/  ChartsScreen.ts, view/ChartsScreenView.ts
└─ assets/  images/, sounds/
```

Icons live only in `src/common/MovingManScreenIcons.ts`.

---

## Wiring in `main.ts` and `*Screen.ts`

```typescript
// src/main.ts
const movingManPreferences = new MovingManPreferencesModel(
  Tandem.ROOT.createTandem("preferences"),
);

const screens = [
  new IntroScreen({
    preferences: movingManPreferences,
    name: screenNames.introStringProperty,
    tandem: Tandem.ROOT.createTandem("introScreen"),
    backgroundColorProperty: MovingManColors.backgroundColorProperty,
  }),
  new ChartsScreen({
    preferences: movingManPreferences,
    name: screenNames.chartsStringProperty,
    tandem: Tandem.ROOT.createTandem("chartsScreen"),
    backgroundColorProperty: MovingManColors.backgroundColorProperty,
  }),
];
```

```typescript
// src/intro/IntroScreen.ts
import { createIntroIcon } from "../common/MovingManScreenIcons.js";

optionize<IntroScreenOptions, EmptySelfOptions, ScreenOptions>()(
  {
    homeScreenIcon: createIntroIcon(),
    navigationBarIcon: createIntroIcon(),
    createKeyboardHelpNode: () => new MovingManKeyboardHelpContent(),
  },
  options,
);
```

`ChartsScreen` is the same pattern with `createChartsIcon()` and a full
recording-enabled model.

---

## Home screen icons

### Fleet convention

```
src/common/MovingManScreenIcons.ts
```

| Screen | Factory |
|---|---|
| Introduction | `createIntroIcon()` |
| Charts | `createChartsIcon()` |

Drawn on the PhET **548 × 373** canvas with `MovingManColors`.

---

## Screen options reference

| Option | Type | Purpose |
|---|---|---|
| `name` | `ReadOnlyProperty<string>` | Localizable tab label |
| `tandem` | `Tandem` | PhET-iO registration root |
| `backgroundColorProperty` | `TReadOnlyProperty<Color>` | Screen background |
| `createKeyboardHelpNode` | `() => Node` | Keyboard help |
| `homeScreenIcon` | `ScreenIcon` | Home-screen icon |
| `navigationBarIcon` | `ScreenIcon` | Nav-bar icon |
| `preferences` | `MovingManPreferencesModel` | Shared Preferences |

---

## Strings and accessibility

Titles via `getScreenNames()`: `intro` (“Introduction”), `charts` (“Charts”).

Keyboard help is shared (`MovingManKeyboardHelpContent`). Prefer distinct
screen summaries when documenting Intro vs Charts interactions.

---

## Adding another screen

1. Add a `screens` key in every locale; expose it from `getScreenNames()`.
2. Add a `*Screen.ts` (and view) in a new screen folder (`src/<screen>/` with `view/`), reusing `src/common/`.
3. Add `create…Icon()` to `MovingManScreenIcons.ts` and wire both icons in the
   Screen’s `optionize` defaults.
4. Register in `main.ts` with `preferences`, `name`, tandem, and background.
