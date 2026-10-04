# Recording review — 2026-10-04

Reviewed the recording/playback model, fixed-step limits, history lookup, motion-strategy stepping, derivative buffers and transport controls. This was a focused static review supplemented by unit regressions and browser smoke checks.

## Finding addressed

- **P2 — rewind skips the initial state:** history started after the first physics step, so rewinding to zero showed a moved man. Capture the current state before advancing an empty recording, including runs started with Step.

## Validation

The new initial-position regression failed before the fix. Lint, app/scripts/test TypeScript checks, unit tests, production build, and Chromium pointer/keyboard quick fuzz passed on the shared working tree (22 tests, including concurrent changes).

Existing package-lock.json edits and concurrent edits to the kinematics, wall handling, sprite, and other tests were excluded from this recording fix commit.
