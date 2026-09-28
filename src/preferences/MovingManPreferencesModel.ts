/**
 * MovingManPreferencesModel.ts
 *
 * Model for the simulation-specific preferences shown in Preferences →
 * Simulation. Each preference Property takes its initial value from the
 * corresponding query parameter in movingManQueryParameters.
 */

import { BooleanProperty } from "scenerystack/axon";
import type { Tandem } from "scenerystack/tandem";
import MovingManNamespace from "../MovingManNamespace.js";
import movingManQueryParameters from "./movingManQueryParameters.js";

export class MovingManPreferencesModel {
  public readonly wallsEnabledProperty: BooleanProperty;
  public readonly showVelocityVectorProperty: BooleanProperty;
  public readonly showAccelerationVectorProperty: BooleanProperty;

  public constructor(tandem?: Tandem) {
    this.wallsEnabledProperty = new BooleanProperty(
      movingManQueryParameters.wallsEnabled,
      tandem ? { tandem: tandem.createTandem("wallsEnabledProperty") } : undefined,
    );
    this.showVelocityVectorProperty = new BooleanProperty(
      movingManQueryParameters.showVelocityVector,
      tandem ? { tandem: tandem.createTandem("showVelocityVectorProperty") } : undefined,
    );
    this.showAccelerationVectorProperty = new BooleanProperty(
      movingManQueryParameters.showAccelerationVector,
      tandem ? { tandem: tandem.createTandem("showAccelerationVectorProperty") } : undefined,
    );
  }

  public reset(): void {
    this.wallsEnabledProperty.reset();
    this.showVelocityVectorProperty.reset();
    this.showAccelerationVectorProperty.reset();
  }
}

MovingManNamespace.register("MovingManPreferencesModel", MovingManPreferencesModel);
