# AGENTS.md — Moving Man

Sim-specific context for AI assistants. General SceneryStack guidance: [OpenLyceum/.github/AGENTS.md](https://github.com/OpenLyceum/.github/blob/main/AGENTS.md).

## Project

SceneryStack port of the PhET Java *Moving Man* simulation. Two screens: **Introduction** (play area + sliders, live motion, no graphs) and **Charts** (record/playback time-series graphs). The man moves in **1D**; you drive one kinematic quantity and the other two are derived.

Physics for educators: `doc/model.md`. Architecture: `doc/implementation-notes.md`.

## Key files

| Area | Location |
|---|---|
| Screens | `src/intro/IntroScreen.ts` + `view/IntroScreenView.ts`, `src/charts/ChartsScreen.ts` + `view/ChartsScreenView.ts` |
| Model | `src/common/model/MovingManModel.ts` (screen state + step), `MovingMan.ts` (kinematics + motion strategies), `DataSeries.ts` (time-series buffers), `MotionStrategy.ts`, `functionPresets.ts` (x(t) presets), `MovingManConstants.ts` |
| Numerics | `model/motionMath.ts` (centered derivatives), `model/binarySearch.ts` |
| View | `src/common/view/ChartNode.ts`, `MovingManSpriteNode.ts`, `PlayAreaNode.ts`, `MovingManScreenSummaryContent.ts` |
| Sounds | `view/MovingManSounds.ts` — wall collision thud + grunt |
| A11y helpers | `view/speakValueOnFocus.ts` — announces the man's position / chart cursor time while focused |
| Colors / strings | `MovingManColors.ts`, `MovingManNamespace.ts`, `src/i18n/StringManager.ts` |

## Model

`MovingManModel` owns the screen-level state and the play/record loop; `MovingMan` owns the man's kinematics. `MotionStrategy` is a string-union (`position` / `velocity` / `acceleration`) — the **driving** quantity; the others are derived from it.

| Property | Owner · type | Meaning |
|---|---|---|
| `recordingProperty` | model · `BooleanProperty` (true) | recording vs. playback |
| `isPlayingProperty` | model · `BooleanProperty` (false) | play/pause |
| `timeProperty` / `furthestRecordedTimeProperty` | model · `NumberProperty` (s) | playback cursor / recording length |
| `playbackSpeedProperty` | model · `NumberProperty` | playback rate multiplier |
| `wallsEnabledProperty` | model · `BooleanProperty` | bound the man between walls |
| `showVelocityVectorProperty` / `showAccelerationVectorProperty` | model · `BooleanProperty` | vector overlays |
| `positionProperty` / `velocityProperty` / `accelerationProperty` | man · `NumberProperty` (m, m/s, m/s²) | kinematics |
| `motionStrategyProperty` | man · `Property<MotionStrategy>` (default `position`) | which quantity drives motion |
| `functionProperty` | man · `Property<MovingManFunctionPreset \| null>` | active x(t) preset, or null |

### Stepping, derivation & walls

- **Fixed timestep accumulator.** `step(dt)` runs whole `FIXED_DT` slices (capped by `MAX_CATCHUP_STEPS`), gated on play state; recording vs. playback branches per slice. Introduction uses `noRecording: true` for live-only motion.
- **Strategy determines derivation direction:** position-driven → velocity & acceleration by **differentiation** (`estimatedCenteredDerivatives` over the data series, with mid-point smoothing); velocity-driven → position by **integration**, acceleration by differentiation; acceleration-driven → velocity & position by integration (trapezoidal mid-velocity). `snapToZero` cleans tiny residuals so a parked man reads exactly 0.
- **Walls:** `clampIfWalled` clamps the new position to the wall; on a collision the driving velocity is zeroed and `collideEmitter` fires → `MovingManSounds` thud.
- **Time limit:** recording stops at exactly `MAX_TIME`; the clock never advances past it (or past the end of a recording in playback), and Play at the end of a recording replays from 0. Limits are compared with `TIME_EPSILON` because summed `FIXED_DT` drifts.
- **User input during playback:** dragging the man or touching a slider calls `takeControlFromPlayback()`, which records over the rest of the run from the cursor. A drag also starts playing; a slider keeps the play/pause state so initial values can be set while paused.
- **Presets:** choosing an x(t) preset sets the strategy to `position` (directly, since `setPositionDriven()` clears the preset). Rewind (the Intro restart button, the Charts rewind button) restarts the clock and moves the man to x(0), so a preset can be replayed without re-picking it.
- **Preferences** apply live (lazy-linked to the model Properties) and are re-applied as defaults by Reset All.
- `DataSeries` keeps parallel *model* and *graph* series per quantity (plus a `mouseDataSeries` for pointer drags) feeding the Charts screen.

## Accessibility

Follows the shared [OpenLyceum accessibility convention](https://github.com/OpenLyceum/Baton/blob/main/ACCESSIBILITY.md).
Both screens register the shared `MovingManScreenSummaryContent` (live current-details: the man's
position/velocity/acceleration + playback state) via the `screenSummaryContent` super-option, and
order the PDOM through `pdomPlayAreaNode`/`pdomControlAreaNode`. The draggable man and the chart
time cursor have help text and speak their value (position / time) after keyboard moves via
`speakValueOnFocus`; the Charts keyboard-help dialog documents cursor scrubbing (arrows, Home/End). A11y strings live under `a11y` in
each locale JSON, via `StringManager.getA11yStrings()`.

## Compliance carve-outs

- **Nested constants:** `src/MovingManConstants.ts` — PhET-port kinematics/layout constants next to the model.
- **Domain clock:** recording/playback uses the model's own `recordingProperty` / `isPlayingProperty` / `timeProperty` instead of composing fleet-standard `TimeModel`.
- **PWA splash:** `background_color` is `#ffffff` (and `index.html` body matches) because this PhET port uses a light play area; other sims keep `#000000`.


### `package.json` overrides

JSON cannot carry comments, so the rationale for forced transitive pins lives here. Prefer
**tilde (`~`) or exact** versions — caret (`^`) lets minors drift under what is meant to be a
hard pin. Dependabot ignores these three names (see `.github/dependabot.yml`) so it does not
open PRs that fight the overrides. Revisit when SceneryStack drops or re-pins them upstream.

| Override | Pin | Why |
|---|---|---|
| `lodash` | `~4.18.1` | SceneryStack declares `~4.17.12`. Bump clears Dependabot/npm advisories patched in 4.18.x (e.g. GHSA-r5fr-rjxr-66jc, GHSA-f23m-r3pf-42rh). |
| `three` | `~0.125.2` | SceneryStack declares `^0.104.0`. Floor is 0.125.0 for GHSA-fq6p-x6j3-cmmq (ReDoS). Staying on the 0.125 line avoids a larger API jump; **0.125.x still has open CVEs** (e.g. XSS GHSA-7vvq-7r29-5vg3, fixed only in ≥0.137.0). Remove this override if/when SceneryStack stops depending on `three` or pins a patched line itself. LightPropagation keeps a higher `three` pin — do not force 0.125 there. |
| `brace-expansion` | `~5.0.9` | Transitive via `vite-plugin-pwa` / Workbox. Clears npm audit (originally GHSA-mh99-v99m-4gvg; keep ≥5.0.9 for GHSA-rgw5-rvv9-x895). |

## Testing

Fleet-standard Vitest layout:

| Path | Purpose |
|---|---|
| `vitest.config.ts` | `happy-dom` environment, `setupFiles`, `execArgv: ["--expose-gc"]` |
| `tests/setup.ts` | Canvas / AudioContext mocks + `init({ name: "…" })` before SceneryStack imports |
| `tests/**/*.test.ts` | Model/physics unit tests — mirror `src/` under `tests/` |
| `tests/memory-leak.test.ts` | WeakRef + `forceGC` dispose regression (fleet pattern) |

Actual specs:

- `tests/common/model/MovingManModel.test.ts`
- `tests/common/view/ChartNode.test.ts` (time-window follow)
- `tests/memory-leak.test.ts`

Run `npm test`. CI runs the suite when a `test` script is present.

## Commands

```bash
npm run lint && npm run check && npm run build
npm test
```

`npm run release` runs `npm test` before the version bump, and `src/init.ts` reads `version` from `package.json`, so the About dialog always matches the release.

## Development notes

- Free-form x(t) formula entry replaced by an **x(t) preset menu** (`FunctionComboBox`) — SceneryStack has no built-in text input.
- Man rendered as a sprite with walking animation and wall-collision lean. Easter-egg cloud animation from the original is not included.
- Enums use a `const` object + string-literal union (not a TS `enum`) to stay compatible with `erasableSyntaxOnly`.
