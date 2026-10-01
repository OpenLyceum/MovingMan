# Model - Moving Man

This document describes the model (the underlying physics, math, and behavior) for the simulation,
in terms appropriate for an educator. It is the companion to
[implementation-notes.md](./implementation-notes.md), which targets developers.

## Overview

The simulation teaches **one-dimensional kinematics** through a man walking along a horizontal
track between two walls. Students choose which quantity to control — **position**, **velocity**, or
**acceleration** — and watch the other two evolve, connecting the verbal definitions to graphs and
live motion.

The sim has two screens with the same underlying physics but different presentation:

- **Introduction** — a large play area with sliders, optional walls, and on-body vector arrows.
  Motion runs live with no graphs and no record/playback; the clock simply keeps running.
- **Charts** — a compact play area plus three synchronized **x**, **v**, and **a** versus **t**
  charts, with full record, pause, scrub, and playback-speed control.

An optional **x(t) preset menu** (replacing the original's free-form formula box) drives position
from familiar functions — linear, parabolic, sinusoidal, square-root — so students see how shape
in one graph propagates to the others.

Key ideas a student should take away:

- The same kinematic story looks different depending on which quantity you treat as "given."
- Differentiating a noisy hand-dragged position twice to get acceleration produces jitter unless
  smoothed — the sim uses centered least-squares windows, so acceleration **lags** hand motion
  slightly.
- Walls clamp position and zero velocity on impact; they do not model elastic bouncing.

## Quantities and units

| Quantity | Symbol | Units | Notes |
|---|---|---|---|
| Position | x | m | Along the track; nominally −10 m to +10 m |
| Velocity | v | m/s | Rate of change of position |
| Acceleration | a | m/s² | Rate of change of velocity |
| Time | t | s | Model clock; Charts screen records up to 20 s |

## Governing equations

One-dimensional kinematics:

```
v = dx/dt        a = dv/dt
```

Integrated each fixed step Δt when velocity or acceleration drives motion:

```
v ← v + a · Δt        x ← x + v · Δt
```

**Motion strategy** (which quantity the student sets):

| Strategy | Student sets | Model derives |
|---|---|---|
| Position | x (drag / slider) | v, a by **centered numerical differentiation** over recent history |
| Velocity | v (slider) | x by integration; a by differentiation |
| Acceleration | a (slider) | v and x by integration (trapezoidal mid-velocity for x) |

When an **x(t) preset** is active, position follows the chosen function of time; velocity and
acceleration are the usual numerical derivatives of that trajectory (walls still clamp x).

**Walls** (when enabled): if the integrated position would cross ±10 m, it is clamped to the
boundary and the velocity is set to zero — an inelastic stop, not a bounce.

## Simplifications and assumptions

- **Pure kinematics** — no mass, forces, or friction; the man's motion is prescribed or
  slider-driven, not Newtonian.
- **Point particle** — the sprite is decorative; physics is strictly 1-D.
- **Derivative smoothing** — position-mode acceleration uses a widened centered window
  (7-point regression) so hand-dragged motion does not produce absurd acceleration spikes; this
  introduces ~250 ms readout lag at the default tuning.
- **Fixed internal timestep** (1/24 s) — calibrated to the Java original; frame rate does not
  change integration speed.
- **Preset formulas only** — arbitrary user-typed x(t) from the Java sim is replaced by a curated
  menu (SceneryStack has no built-in text input).

## References

- One-dimensional kinematics, any introductory mechanics text (e.g. Halliday, Resnick & Walker,
  *Fundamentals of Physics*, Ch. 2–4).
- PhET Interactive Simulations, [*The Moving Man*](https://phet.colorado.edu/en/simulations/moving-man)
  (University of Colorado) — original Java simulation this port reimplements.
