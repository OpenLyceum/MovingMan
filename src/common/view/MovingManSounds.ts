/**
 * MovingManSounds.ts
 *
 * Wall-collision sound effects. Mirrors the original sim, which on every wall hit
 * played a "thud" plus one randomly-chosen "grunt" (grunt01–04). The model already
 * fires `MovingMan.collideEmitter`; here we map that event onto tambo SoundClips.
 *
 * The clips are created and registered with the global soundManager exactly once
 * (lazily, the first time any screen asks for the sounds). soundManager queues
 * generators added before it is initialized, so construction order is not a concern.
 * Audio is enabled via `audioOptions.supportsSound` in main.ts; users toggle it from
 * the navigation-bar sound button.
 */

import type { Emitter } from "scenerystack/axon";
import { phetAudioContext, SoundClip, soundManager, WrappedAudioBuffer } from "scenerystack/tambo";
import gruntSound01 from "../../assets/sounds/grunt01.mp3";
import gruntSound02 from "../../assets/sounds/grunt02.mp3";
import gruntSound03 from "../../assets/sounds/grunt03.mp3";
import gruntSound04 from "../../assets/sounds/grunt04.mp3";
import thudSound from "../../assets/sounds/thud.mp3";

// Quieter than full scale so a wall hit isn't jarring.
const OUTPUT_LEVEL = 0.6;

/**
 * Fetch and decode an audio asset (a URL produced by Vite's asset handling) into a
 * WrappedAudioBuffer. The returned buffer's `audioBufferProperty` starts null and is
 * filled in when decoding finishes; SoundClip handles a buffer that arrives later.
 */
function loadAudioBuffer(url: string): WrappedAudioBuffer {
  const wrappedAudioBuffer = new WrappedAudioBuffer();
  fetch(url)
    .then((response) => response.arrayBuffer())
    .then((arrayBuffer) => phetAudioContext.decodeAudioData(arrayBuffer))
    .then((audioBuffer) => {
      wrappedAudioBuffer.audioBufferProperty.value = audioBuffer;
    })
    .catch((err: unknown) => {
      // biome-ignore lint/suspicious/noConsole: surface audio-load failures
      console.warn("MovingMan: failed to load audio", url, err);
    });
  return wrappedAudioBuffer;
}

let thudClip: SoundClip | null = null;
let gruntClips: SoundClip[] = [];

/** Create and register the collision clips once. */
function ensureClips(): void {
  if (thudClip) {
    return;
  }
  thudClip = new SoundClip(loadAudioBuffer(thudSound), { initialOutputLevel: OUTPUT_LEVEL });
  gruntClips = [gruntSound01, gruntSound02, gruntSound03, gruntSound04].map(
    (url) => new SoundClip(loadAudioBuffer(url), { initialOutputLevel: OUTPUT_LEVEL }),
  );
  soundManager.addSoundGenerator(thudClip);
  for (const clip of gruntClips) {
    soundManager.addSoundGenerator(clip);
  }
}

/** Play a thud plus a random grunt, stopping any still-playing collision clips first. */
function playCollision(): void {
  ensureClips();
  thudClip?.stop();
  for (const clip of gruntClips) {
    clip.stop();
  }
  thudClip?.play();
  const grunt = gruntClips[Math.floor(Math.random() * gruntClips.length)];
  grunt?.play();
}

/**
 * Wire a model's collision emitter to the collision sounds. Safe to call once per
 * screen; the underlying clips are shared across all callers.
 *
 * @param collideEmitter - emitter that fires on every wall hit.
 * @returns a disposer that detaches this screen's listener (the shared clips stay registered).
 */
export function addCollisionSounds(collideEmitter: Emitter): () => void {
  ensureClips();
  collideEmitter.addListener(playCollision);
  return () => collideEmitter.removeListener(playCollision);
}
