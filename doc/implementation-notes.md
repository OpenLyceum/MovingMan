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
  `recordingProperty` false, uses `LimitedSizeDataSeries` for the graph series (short rolling
  windows that only feed the derivative readouts — the Intro screen draws no charts), and skips
  history scrubbing. `ChartsScreen` uses time-limited series (`MAX_TIME` =
  20 s) and full record/playback with `playbackSpeedProperty`.
- **Fixed timestep accumulator.** `FIXED_DT = 1/24 s`, `MAX_CATCHUP_STEPS = 10`. Playback
  multiplies wall-clock dt by `playbackSpeedProperty` but each integration slice still uses
  `FIXED_DT` so derivatives stay stable.
- **Strategy determines derivation direction.** See `MovingMan.dispatchUpdate`:
  position-driven → `estimatedCenteredDerivatives` on model series; velocity-driven → integrate
  x, differentiate a; acceleration-driven → integrate v and x. `snapToZero` clears residuals below
  `1e-6` so a parked man reads exactly 0.
- **Derived graph points keep their own time.** A centered derivative is only available
  `DERIVATIVE_RADIUS` steps back (2× for a). `addDerivativeSample` plots it at that sample time —
  not restamped to "now" — so x, v and a line up on the charts; the live read-out shows the same
  (lagged) value. `addGraphPoint` drops any candidate that is not later than the series' last
  point, keeping every graph series strictly increasing across resets, strategy switches and
  wall impacts.
- **Walls.** `clampIfWalled` clamps x to ±`HALF_CONTAINER_WIDTH`. Slider-driven impacts go
  through `recordWallImpact`, which restarts the v/a derivative windows at the impact so no
  differentiated spike appears; inelastic → v = 0 (acceleration mode also switches to
  velocity-driven), elastic (`elasticWallsProperty`) → `bounceOffWall` solves for the impact time
  inside the step and reverses v there (exact for constant a, so bounces conserve energy).
  `collideEmitter` fires → `MovingManSounds.addCollisionSounds`. `hitsWall` uses exact float
  equality on purpose (clamped positions are exactly the wall coordinate).
- **Playback leaves the walls alone.** History records hold only time + `ManState`; the walls
  toggle is a live setting (also a preference) and is not overwritten during playback.
- **x(t) presets replace formula entry.** `functionProperty` non-null overrides the motion
  strategy; selecting a preset resets time/history and auto-plays. Drag/slider interaction clears
  the preset. Each preset carries exact `velocity` / `acceleration` functions, used instead of
  numerical differentiation (no lag); the derivative windows are still fed so handing control
  back to drag/sliders is smooth.
- **Derivative tuning.** `DERIVATIVE_RADIUS = 3` (widened from PhET's 1) trades read-out lag
  (~125 ms v, ~250 ms a) for smoother hand-drag readouts. `SERIES_SIZE_LIMIT` (4R+1) and
  `NUM_TIME_POINTS_TO_RECORD` (4R) are derived from it in `MovingManConstants.ts`.
- **Nested constants.** `src/MovingManConstants.ts` (fleet carve-out).

## View components

- **IntroScreenView** — full-width play area, three `VariableControl` sliders, walls checkbox,
  vector toggles, `FunctionComboBox`. No playback bar.
- **ChartsScreenView** — compact play area + three collapsible `ChartNode`s (x, v, a vs t),
  `PlaybackControls`, shared vector toggles and preset picker.
- **PlayAreaNode** — ruler, wall graphics, bounds.
- **MovingManSpriteNode** — sprite sheet walking animation; lean on wall collision.
- **ChartNode** — bamboo chart with zoom; reads `MovingMan.*GraphSeries`. When zoomed in on
  time, the window slides to keep the cursor in view (`timeWindowStart`). Optional dashed tangent
  line at the cursor (`tangentSegment`), slope read from the next series down; toggled by the
  Charts screen's "Tangent Lines" checkbox (view state, reset by Reset All).
- **MovingManSounds** — registers collision clips with sound manager.

## Disposal conventions

Screen-lifetime views and the man's data series persist for the session. No dynamic particle
add/remove. Fleet memory-leak suite uses a minimal dispose pattern (see `tests/memory-leak.test.ts`).

## Testing

`npm test` (vitest):

- `tests/common/model/MovingManModel.test.ts` — screen-level stepping, record/playback, presets,
  preferences, walls
- `tests/common/model/kinematics.test.ts` — closed-form checks: x = ½at², exact preset
  derivatives, x/v/a graph alignment, monotonic timestamps, wall impacts (inelastic and elastic)
- `tests/common/model/{motionMath,binarySearch,DataSeries,functionPresets}.test.ts` — unit tests
  for the numerics, buffers and presets (incl. which presets reach a wall and when)
- `tests/common/view/ChartNode.test.ts` — time-window follow and tangent geometry
- `tests/memory-leak.test.ts` — WeakRef/GC regression suite

CI also runs `npm run lint && npm run check && npm run build`.

## Multi-screen simulations

Intro and Charts share `MovingManScreenSummaryContent` and keyboard-help patterns. For fleet
multi-screen conventions (StringManager getters, per-screen folders), see [SceneryStackTemplate `doc/multi-screen.md`](https://github.com/OpenLyceum/SceneryStackTemplate/blob/main/doc/multi-screen.md) if
adding a third screen.
