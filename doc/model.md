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
from familiar functions — linear, parabolic, sinusoidal, square-root, a turnaround with non-zero
initial velocity, an exponential approach, a damped oscillation, and a piecewise
cruise-brake-stop — so students see how shape in one graph propagates to the others.

On the Charts screen, **Tangent Lines** draws a dashed line tangent to the x and v graphs at the
time cursor, in the color of the next quantity down: its slope *is* the value on the graph below
(slope of x = v, slope of v = a). While scrubbing a recording, the slider read-outs show x, v and
a at the cursor time.

Key ideas a student should take away:

- The same kinematic story looks different depending on which quantity you treat as "given."
- Differentiating a noisy hand-dragged position twice to get acceleration produces jitter unless
  smoothed — the sim uses centered least-squares windows, so the live v and a read-outs **lag**
  hand motion slightly. The graphs stay aligned in time: each derived point is plotted at the
  instant it describes, so the v and a lines simply end a little before the cursor.
- Walls clamp position and, by default, stop the man dead (inelastic). An optional
  **elastic walls** preference makes slider-driven motion bounce instead.

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
| x(t) preset | the function x(t) | v, a **exactly**, from the function's own derivatives |
| Velocity | v (slider) | x by integration; a by differentiation |
| Acceleration | a (slider) | v and x by integration (trapezoidal mid-velocity for x) |

When an **x(t) preset** is active, position follows the chosen function of time, and velocity and
acceleration are its exact derivatives evaluated at the same instant (so, e.g., `t² − 8` reads
a = 2.00 m/s² and v crosses zero exactly where `7·sin(t)` peaks). Walls still clamp x; while the
man is pinned against a wall he reads v = a = 0.

**Walls** (when enabled): if the position would cross ±10 m, it is clamped to the boundary.

- *Inelastic (default):* velocity → 0. In acceleration mode the acceleration also → 0 and the
  driving quantity switches to velocity, so the man stays at the wall until a slider is moved.
- *Elastic (Preferences → Elastic Walls, or `?elasticWalls=true`):* velocity → −velocity, solved
  at the exact moment of impact within the time step, so a constant acceleration toward a wall
  bounces like a ball under gravity without gaining or losing energy.

Either way the impact is recorded as a clean jump in v, without a numerically differentiated
spike in a. (Physically an instantaneous stop or reversal is an impulse — a very large
acceleration for a very short time — which is worth discussing with students.) Dragging the man
into a wall is position-driven, so there v and a are differentiated as usual.

## Simplifications and assumptions

- **Pure kinematics** — no mass, forces, or friction; the man's motion is prescribed or
  slider-driven, not Newtonian.
- **Point particle** — the sprite is decorative; physics is strictly 1-D.
- **Derivative smoothing** — position-mode derivatives use a widened centered window
  (7-point regression) so hand-dragged motion does not produce absurd acceleration spikes; the
  live read-outs lag by ~125 ms (v) and ~250 ms (a) at the default tuning, but the graphs are
  not shifted.
- **Fixed internal timestep** (1/24 s) — calibrated to the Java original; frame rate does not
  change integration speed. With constant acceleration the trapezoidal update is exact
  (x = ½at² to machine precision).
- **Preset formulas only** — arbitrary user-typed x(t) from the Java sim is replaced by a curated
  menu (SceneryStack has no built-in text input).

## References

- One-dimensional kinematics, any introductory mechanics text (e.g. Halliday, Resnick & Walker,
  *Fundamentals of Physics*, Ch. 2–4).
- PhET Interactive Simulations, [*The Moving Man*](https://phet.colorado.edu/en/simulations/moving-man)
  (University of Colorado) — original Java simulation this port reimplements.
