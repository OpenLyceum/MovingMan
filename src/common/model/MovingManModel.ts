/**
 * MovingManModel.ts
 *
 * The simulation model: owns the man, advances him on a fixed timestep, and (on the
 * Charts screen) records his state over time so it can be played back and scrubbed.
 * Ported from the original moving-man-simulation.js + its Simulation base. Backbone
 * change-events become axon Properties; the recorded-state machinery is preserved.
 *
 * The Introduction screen constructs this with `noRecording: true`, which makes the
 * man run live (no history) and the graph series behave as short rolling windows.
 */

import { BooleanProperty, NumberProperty } from "scenerystack/axon";
import type { TModel } from "scenerystack/joist";
import { secondsUnit } from "scenerystack/scenery-phet";
import MovingManConstants from "../../MovingManConstants.js";
import type { MovingManPreferencesModel } from "../../preferences/MovingManPreferencesModel.js";
import movingManQueryParameters from "../../preferences/movingManQueryParameters.js";
import { closestIndex } from "./binarySearch.js";
import type { ManState } from "./MovingMan.js";
import { type ManContext, MovingMan } from "./MovingMan.js";

const { FIXED_DT, MAX_CATCHUP_STEPS, HALF_CONTAINER_WIDTH, MAX_TIME } = MovingManConstants;

type HistoryRecord = { time: number; wallsEnabled: boolean; man: ManState };

export type MovingManModelOptions = { noRecording?: boolean; preferences?: MovingManPreferencesModel };

export class MovingManModel implements TModel, ManContext {
  public readonly halfContainerWidth = HALF_CONTAINER_WIDTH;
  public readonly maxTime = MAX_TIME;
  public readonly noRecording: boolean;

  public readonly wallsEnabledProperty = new BooleanProperty(movingManQueryParameters.wallsEnabled);
  public readonly recordingProperty = new BooleanProperty(true);
  public readonly isPlayingProperty = new BooleanProperty(false);
  public readonly timeProperty = new NumberProperty(0, { units: secondsUnit });
  public readonly furthestRecordedTimeProperty = new NumberProperty(0, { units: secondsUnit });
  public readonly playbackSpeedProperty = new NumberProperty(1);

  // Vector-arrow visibility (shown on the man in the play area).
  public readonly showVelocityVectorProperty = new BooleanProperty(movingManQueryParameters.showVelocityVector);
  public readonly showAccelerationVectorProperty = new BooleanProperty(movingManQueryParameters.showAccelerationVector);

  public readonly movingMan: MovingMan;

  private readonly history: HistoryRecord[] = [];
  private historyTimes: number[] | null = null;
  private time = 0;
  private timeAccumulator = 0;

  private readonly preferences: MovingManPreferencesModel | undefined;

  public constructor(providedOptions?: MovingManModelOptions) {
    this.noRecording = providedOptions?.noRecording ?? false;
    this.preferences = providedOptions?.preferences;
    this.applyPreferences();
    if (this.noRecording) {
      this.recordingProperty.value = false;
    }
    this.movingMan = new MovingMan(this, this.noRecording);

    // Choosing a preset function restarts the run from t = 0 so the whole trajectory
    // plays out. On the Charts screen we record it live; on Intro it just runs.
    this.movingMan.functionProperty.lazyLink((preset) => {
      if (preset) {
        this.pause();
        if (!this.noRecording) {
          this.recordingProperty.value = true;
        }
        this.resetTimeAndHistory();
        this.play();
      }
    });
  }

  // ── ManContext ────────────────────────────────────────────────────────────────

  public get wallsEnabled(): boolean {
    return this.wallsEnabledProperty.value;
  }

  public isPaused(): boolean {
    return !this.isPlayingProperty.value;
  }

  // ── Stepping ──────────────────────────────────────────────────────────────────

  /** Called by joist each frame with the real (variable) elapsed time. */
  public step(dt: number): void {
    if (!this.isPlayingProperty.value) {
      return;
    }
    // Playback speed scales how fast model time progresses; the integration dt itself
    // stays fixed so the derivative estimates remain stable.
    this.timeAccumulator += dt * this.playbackSpeedProperty.value;
    let steps = 0;
    while (this.timeAccumulator >= FIXED_DT && steps < MAX_CATCHUP_STEPS && this.isPlayingProperty.value) {
      this.timeAccumulator -= FIXED_DT;
      this.stepInternal(FIXED_DT);
      steps++;
    }
    if (steps >= MAX_CATCHUP_STEPS) {
      this.timeAccumulator = 0;
    }
  }

  /** Advance exactly one fixed slice regardless of play state (the Step button). */
  public stepOnce(): void {
    this.stepInternal(FIXED_DT);
  }

  private stepInternal(delta: number): void {
    this.time += delta;
    this.timeProperty.value = this.time;

    if (this.recordingProperty.value) {
      if (this.time > this.maxTime) {
        this.pause();
        return;
      }
      this.movingMan.update(this.time, delta);
      this.recordState();
      this.furthestRecordedTimeProperty.value = this.time;
      if (this.time >= this.maxTime) {
        this.pause();
      }
    } else if (!this.noRecording) {
      this.applyPlaybackState();
      if (this.time >= this.furthestRecordedTimeProperty.value) {
        this.pause();
      }
    } else {
      this.movingMan.update(this.time, delta);
    }
  }

  // ── Recording / playback ──────────────────────────────────────────────────────

  private recordState(): void {
    this.history.push({
      time: this.time,
      wallsEnabled: this.wallsEnabledProperty.value,
      man: this.movingMan.getState(),
    });
  }

  private applyPlaybackState(): void {
    const record = this.findStateWithClosestTime(this.time);
    if (record) {
      this.wallsEnabledProperty.value = record.wallsEnabled;
      this.movingMan.applyState(this.time, record.man);
    }
  }

  private findStateWithClosestTime(time: number): HistoryRecord | null {
    if (!this.historyTimes) {
      return null;
    }
    const index = closestIndex(this.historyTimes, time);
    return index >= 0 ? (this.history[index] ?? null) : null;
  }

  private prepareForPlayback(): void {
    this.history.sort((a, b) => a.time - b.time);
    this.historyTimes = this.history.map((record) => record.time);
  }

  public playingBack(): boolean {
    return !(this.recordingProperty.value || this.noRecording);
  }

  // ── Public controls ───────────────────────────────────────────────────────────

  public play(): void {
    if (!this.recordingProperty.value) {
      this.prepareForPlayback();
    }
    this.isPlayingProperty.value = true;
  }

  public pause(): void {
    this.isPlayingProperty.value = false;
  }

  /** Pause and jump back to t = 0 (clearing history when recording). */
  public rewind(): void {
    this.pause();
    this.time = 0;
    this.timeProperty.value = 0;
    if (this.recordingProperty.value) {
      this.resetTimeAndHistory();
    } else {
      this.applyPlaybackState();
    }
  }

  /** Pause and wipe all recorded time and history. */
  public clear(): void {
    this.pause();
    this.resetTimeAndHistory();
  }

  private resetTimeAndHistory(): void {
    this.history.length = 0;
    this.historyTimes = null;
    this.timeAccumulator = 0;
    this.time = 0;
    this.timeProperty.value = 0;
    this.furthestRecordedTimeProperty.value = 0;
    this.movingMan.clear();
  }

  private clearHistoryAfter(time: number): void {
    for (let i = this.history.length - 1; i >= 0; i--) {
      if ((this.history[i]?.time ?? 0) >= time) {
        this.history.splice(i, 1);
      }
    }
    this.historyTimes = null;
    this.furthestRecordedTimeProperty.value = time;
    this.movingMan.clearHistoryAfter(time);
  }

  /** Switch into record mode, recording over anything after the current cursor. */
  public record(): void {
    this.pause();
    this.clearHistoryAfter(this.time);
    this.recordingProperty.value = true;
  }

  /** Switch into playback mode, rewinding to the start. */
  public stopRecording(): void {
    this.pause();
    this.prepareForPlayback();
    this.time = 0;
    this.timeProperty.value = 0;
    this.recordingProperty.value = false;
    this.applyPlaybackState();
  }

  /** Scrub to a recorded time and show that frame (used by the chart cursor). */
  public setPlaybackTime(time: number): void {
    this.time = time;
    this.timeProperty.value = time;
    if (!this.historyTimes) {
      this.prepareForPlayback();
    }
    this.applyPlaybackState();
  }

  // ── Reset ─────────────────────────────────────────────────────────────────────

  /**
   * Applies the simulation preferences (Preferences → Simulation). Called on
   * construction and Reset All so the preference defaults take effect.
   */
  private applyPreferences(): void {
    if (!this.preferences) {
      return;
    }
    this.wallsEnabledProperty.value = this.preferences.wallsEnabledProperty.value;
    this.showVelocityVectorProperty.value = this.preferences.showVelocityVectorProperty.value;
    this.showAccelerationVectorProperty.value = this.preferences.showAccelerationVectorProperty.value;
  }

  public reset(): void {
    this.pause();
    this.wallsEnabledProperty.reset();
    this.recordingProperty.value = !this.noRecording;
    this.timeProperty.reset();
    this.furthestRecordedTimeProperty.reset();
    this.playbackSpeedProperty.reset();
    this.showVelocityVectorProperty.reset();
    this.showAccelerationVectorProperty.reset();

    this.movingMan.functionProperty.reset();
    this.movingMan.positionProperty.reset();
    this.movingMan.velocityProperty.reset();
    this.movingMan.accelerationProperty.reset();
    this.movingMan.motionStrategyProperty.reset();
    this.movingMan.setMousePosition(0);

    this.applyPreferences();
    this.resetTimeAndHistory();
  }
}
