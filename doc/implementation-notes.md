# Implementation Notes - Moving Man

Developer-facing notes on the architecture. The physics itself is documented for educators in
[model.md](./model.md).

## Architecture Overview

Moving Man is a two-screen SceneryStack simulation, a TypeScript port of PhET's *Moving Man*
Java/HTML5 sim. Each screen constructs its own `MovingManModel` instance with different options.

```
src/
  main.ts, brand.ts, splash.ts, assert.ts, init.ts     bootstrap chain
  MovingManColors.ts, MovingManNamespace.ts
  i18n/StringManager.ts, strings_*.json
  preferences/                                          query params + Preferences
  intro/IntroScreen.ts, intro/view/IntroScreenView.ts  model(noRecording: true) + IntroScreenView
  charts/ChartsScreen.ts, charts/view/ChartsScreenView.ts  full model + ChartsScreenView
  assets/images/, assets/sounds/                       sprite frames, tree, wall/grunt sounds
  common/model/
      MovingManModel.ts                                 TModel + ManContext; record/playback
      MovingMan.ts                                      1-D kinematics + motion strategies
      DataSeries.ts                                     rolling / time-limited chart buffers
      MotionStrategy.ts, functionPresets.ts             driving quantity + x(t) presets
      MovingManConstants.ts, motionMath.ts, binarySearch.ts
  common/view/
      PlayAreaNode.ts, MovingManSpriteNode.ts           track, walls, walking sprite
      ChartNode.ts, LinearTransform.ts                  bamboo charts + axis mapping
      VariableControl.ts, FunctionComboBox.ts, WallsCheckbox.ts
      PlaybackControls.ts                               Charts transport only
      MovingManSounds.ts                                wall collision thud + grunt
      MovingManScreenSummaryContent.ts, MovingManKeyboardHelpContent.ts
  common/
    MovingManScreenIcons.ts                              home / nav screen icons
```

Data flows Model → View through AXON `Property` objects and `DataSeries` emitters.

## Key design decisions

- **Two models, one class.** `IntroScreen` passes `{ noRecording: true }`, which sets
  `recordingProperty` false, uses `LimitedSizeDataSeries` for charts (short rolling windows),
  and skips history scrubbing. `ChartsScreen` uses time-limited series (`SERIES_TIME_LIMIT` =
  20 s) and full record/playback with `playbackSpeedProperty`.
- **Fixed timestep accumulator.** `FIXED_DT = 1/24 s`, `MAX_CATCHUP_STEPS = 10`. Playback
  multiplies wall-clock dt by `playbackSpeedProperty` but each integration slice still uses
  `FIXED_DT` so derivatives stay stable.
- **Strategy determines derivation direction.** See `MovingMan.updateFromStrategy`:
  position-driven → `estimateCenteredDerivatives` on model series; velocity-driven → integrate x,
  differentiate a; acceleration-driven → integrate v and x. `snapToZero` clears residuals below
  `1e-6` so a parked man reads exactly 0.
- **Walls.** `clampIfWalled` clamps x to ±`HALF_CONTAINER_WIDTH`; on collision velocity → 0 and
  `collideEmitter` fires → `MovingManSounds.addCollisionSounds`.
- **x(t) presets replace formula entry.** `functionProperty` non-null overrides the motion
  strategy; selecting a preset resets time/history and auto-plays. Drag/slider interaction clears
  the preset.
- **Derivative tuning.** `DERIVATIVE_RADIUS = 3` (widened from PhET's 1) trades ~250 ms
  acceleration lag for smoother hand-drag readouts — documented in `MovingManConstants.ts`.
- **Nested constants.** `src/MovingManConstants.ts` (fleet carve-out).

## View components

- **IntroScreenView** — full-width play area, three `VariableControl` sliders, walls checkbox,
  vector toggles, `FunctionComboBox`. No playback bar.
- **ChartsScreenView** — compact play area + three collapsible `ChartNode`s (x, v, a vs t),
  `PlaybackControls`, shared vector toggles and preset picker.
- **PlayAreaNode** — ruler, wall graphics, bounds.
- **MovingManSpriteNode** — sprite sheet walking animation; lean on wall collision.
- **ChartNode** — bamboo chart with zoom; reads `MovingMan.*GraphSeries`.
- **MovingManSounds** — registers collision clips with sound manager.

## Disposal conventions

Screen-lifetime views and the man's data series persist for the session. No dynamic particle
add/remove. Fleet memory-leak suite uses a minimal dispose pattern (see `tests/memory-leak.test.ts`).

## Testing

`npm test` (vitest):

- `tests/common/model/MovingManModel.test.ts` — acceleration-mode integration, reset, wall
  collision when enabled
- `tests/memory-leak.test.ts` — WeakRef/GC regression suite

CI also runs `npm run lint && npm run check && npm run build`.

## Multi-screen simulations

Intro and Charts share `MovingManScreenSummaryContent` and keyboard-help patterns. For fleet
multi-screen conventions (StringManager getters, per-screen folders), see `doc/multi-screen.md` if
adding a third screen.
