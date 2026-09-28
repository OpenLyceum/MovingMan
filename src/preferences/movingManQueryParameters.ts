/**
 * movingManQueryParameters.ts
 *
 * Sim-specific startup query parameters. This is the single place where every
 * sim-specific query parameter is declared and documented. Public-facing
 * parameters (intended for end users / sharing links) must set `public: true`.
 *
 * ── How to add a query parameter ──────────────────────────────────────────────
 * 1. Add an entry below with a `type`, `defaultValue`, and (if user-facing)
 *    `public: true`. Add `isValidValue` to bound numeric ranges.
 * 2. If it should also be user-editable at runtime, surface it as a preference
 *    in MovingManPreferencesModel (initialize that Property from this query parameter).
 *
 * Usage: append e.g. `?showVelocityVector=true&wallsEnabled=false` to the sim URL.
 */

import { logGlobal } from "scenerystack/phet-core";
import { QueryStringMachine } from "scenerystack/query-string-machine";
import MovingManNamespace from "../MovingManNamespace.js";

const movingManQueryParameters = QueryStringMachine.getAll({
  /** Whether the bounding walls are enabled by default. */
  wallsEnabled: {
    type: "boolean",
    defaultValue: true,
    public: true,
  },

  /** Whether the velocity vector is shown by default. */
  showVelocityVector: {
    type: "boolean",
    defaultValue: false,
    public: true,
  },

  /** Whether the acceleration vector is shown by default. */
  showAccelerationVector: {
    type: "boolean",
    defaultValue: false,
    public: true,
  },
});

MovingManNamespace.register("movingManQueryParameters", movingManQueryParameters);

// Log query parameters (for the console / PhET-iO).
logGlobal("phet.chipper.queryParameters");

export default movingManQueryParameters;
