/**
 * MovingManSpriteNode.ts
 *
 * The iconic Moving Man: the photographic figure (black suit, sunglasses) from the
 * original PhET Java sim, rendered as a Scenery sprite. He stands when at rest and
 * switches to a mid-stride walking frame when moving, facing the direction of travel,
 * with a springy footstep bob, a ground shadow, and a comedic lean-and-recover when he
 * bonks a wall. Velocity (red) and acceleration (green) arrows float above his head.
 */

import { PatternStringProperty } from "scenerystack/axon";
import { Matrix3, toFixed } from "scenerystack/dot";
import { Shape } from "scenerystack/kite";
import { Image, Node, Path, RichDragListener } from "scenerystack/scenery";
import { ArrowNode } from "scenerystack/scenery-phet";
import { Animation, Easing } from "scenerystack/twixt";
import walkingImageUrl from "../../assets/images/man-left.gif";
import standingImageUrl from "../../assets/images/man-standing.gif";
import { StringManager } from "../../i18n/StringManager.js";
import MovingManColors from "../../MovingManColors.js";
import MovingManConstants from "../../MovingManConstants.js";
import type { MovingManModel } from "../model/MovingManModel.js";
import type { LinearTransform } from "./LinearTransform.js";
import { speakValueOnFocus } from "./speakValueOnFocus.js";

const { VELOCITY_SCALE, ACCELERATION_SCALE } = MovingManConstants;

// Native pixel sizes of the source art (feet flush with the bottom edge).
const STANDING_NATIVE = { width: 150, height: 401 };
const WALKING_NATIVE = { width: 150, height: 331 };

// Speed (m/s) above which the man faces his direction of travel and switches to the
// walking frame. Below it he stands still and keeps his last facing.
const FACING_THRESHOLD = 0.1;
const WALK_THRESHOLD = 0.25;

// ── Footstep bob ────────────────────────────────────────────────────────────────
// Peak rise (as a fraction of the man's height), the speed (m/s) at which the bob
// reaches full amplitude, and the step cadence (rad/s).
const BOB_FRACTION = 0.035;
const WALK_REF_SPEED = 6;
const WALK_CADENCE = 9;

// ── Crash wobble ──────────────────────────────────────────────────────────────────
// Lean angle (rad) on a wall hit, eased back to upright over this many seconds.
const CRASH_LEAN = 0.2;
const CRASH_DURATION = 0.5;

const ARROW_GAP_ABOVE_HEAD = 18;
const ARROW_STACK_GAP = 18;

const ARROW_OPTIONS = {
  headHeight: 12,
  headWidth: 14,
  tailWidth: 5,
  stroke: null,
};

export type MovingManSpriteNodeOptions = {
  transform: LinearTransform;
  feetY: number;
  /** Target standing height of the figure, in view pixels. */
  manHeight: number;
  /** Gap (px) between the top of the head and the velocity arrow. */
  arrowGapAboveHead?: number;
  /** Vertical gap (px) between the stacked velocity and acceleration arrows. */
  arrowStackGap?: number;
};

export class MovingManSpriteNode extends Node {
  public constructor(model: MovingManModel, options: MovingManSpriteNodeOptions) {
    super({
      cursor: "pointer",
      // Permanent per-screen object; never disposed (the model links and crash Animation below
      // are lifetime-scoped). Expose the man to the PDOM as a focusable, keyboard-draggable control.
      isDisposable: false,
      tagName: "div",
      focusable: true,
      accessibleName: StringManager.getInstance().getA11yStrings().manAccessibleNameStringProperty,
      accessibleHelpText: StringManager.getInstance().getA11yStrings().manHelpTextStringProperty,
    });

    const {
      transform,
      feetY,
      manHeight: h,
      arrowGapAboveHead = ARROW_GAP_ABOVE_HEAD,
      arrowStackGap = ARROW_STACK_GAP,
    } = options;
    const man = model.movingMan;

    // Both frames share one pixels-per-native-pixel scale so the figure keeps a
    // consistent size; the walking pose is naturally a little shorter (bent stride).
    const scale = h / STANDING_NATIVE.height;
    const figureWidth = STANDING_NATIVE.width * scale;

    const standing = new Image(standingImageUrl, {
      scale,
      initialWidth: STANDING_NATIVE.width,
      initialHeight: STANDING_NATIVE.height,
    });
    // The walking art faces left; mirroring the whole figure makes him face right.
    const walking = new Image(walkingImageUrl, {
      scale,
      initialWidth: WALKING_NATIVE.width,
      initialHeight: WALKING_NATIVE.height,
    });
    for (const frame of [standing, walking]) {
      frame.centerX = 0;
      frame.bottom = 0;
    }
    walking.visible = false;

    // The frames live in a dedicated "flipper" child that carries only the horizontal
    // mirror (set as an absolute, idempotent matrix). The "figure" wrapper carries the
    // footstep bob and crash-tilt, all without disturbing the shadow or the arrows.
    const flipper = new Node({ children: [standing, walking] });
    const figure = new Node({ children: [flipper] });

    // Soft ground shadow, kept on the ground (outside the bobbing figure).
    const shadow = new Path(Shape.ellipse(0, 0, figureWidth * 0.42, figureWidth * 0.12, 0), {
      fill: MovingManColors.manShadowProperty,
      y: -2,
    });

    // Arrows sit above the head (head top is at -h in local coords).
    const velocityArrow = new ArrowNode(0, 0, 0, 0, { ...ARROW_OPTIONS, fill: MovingManColors.velocityProperty });
    const accelerationArrow = new ArrowNode(0, 0, 0, 0, {
      ...ARROW_OPTIONS,
      fill: MovingManColors.accelerationProperty,
    });
    const velocityArrowY = -h - arrowGapAboveHead;
    const accelerationArrowY = velocityArrowY - arrowStackGap;

    this.children = [shadow, figure, velocityArrow, accelerationArrow];
    this.y = feetY;

    man.positionProperty.link((position) => {
      this.x = transform.modelToViewX(position);
    });

    // Screen readers hear where the man ended up after each keyboard move.
    speakValueOnFocus(
      this,
      new PatternStringProperty(
        StringManager.getInstance().getA11yStrings().manPositionResponseStringProperty,
        { position: man.positionProperty },
        { maps: { position: (position: number) => toFixed(position, 1) } },
      ),
    );

    // ── Facing + walk/stand frame selection ──────────────────────────────────────
    // facing is +1 to face left (native walking art) or -1 to face right (mirrored). The
    // mirror is applied as an absolute matrix, and only when facing actually changes:
    // setScaleMagnitude cannot be used here because it reads the scale back as a positive
    // magnitude, so a repeated setScaleMagnitude(-1, 1) appends scaling(-1) every call and
    // flips the figure every frame — a flicker seen only when walking right.
    let facing = 1;
    man.velocityProperty.link((velocity) => {
      let nextFacing = facing;
      if (velocity > FACING_THRESHOLD) {
        nextFacing = -1; // moving right -> mirror the left-facing art
      } else if (velocity < -FACING_THRESHOLD) {
        nextFacing = 1; // moving left -> art as drawn
      }
      if (nextFacing !== facing) {
        facing = nextFacing;
        flipper.matrix = Matrix3.scaling(facing, 1);
      }

      const walkingNow = Math.abs(velocity) > WALK_THRESHOLD;
      walking.visible = walkingNow;
      standing.visible = !walkingNow;
      if (!walkingNow) {
        figure.y = 0;
        shadow.setScaleMagnitude(1, 1);
      }

      MovingManSpriteNode.updateArrow(
        velocityArrow,
        velocity,
        VELOCITY_SCALE,
        transform.pixelsPerMeter,
        velocityArrowY,
      );
    });

    man.accelerationProperty.link((acceleration) => {
      MovingManSpriteNode.updateArrow(
        accelerationArrow,
        acceleration,
        ACCELERATION_SCALE,
        transform.pixelsPerMeter,
        accelerationArrowY,
      );
    });

    model.showVelocityVectorProperty.link((visible) => {
      velocityArrow.visible = visible;
    });
    model.showAccelerationVectorProperty.link((visible) => {
      accelerationArrow.visible = visible;
    });

    // ── Footstep bob: a springy rise synced to the stride while moving ────────────
    const maxBob = BOB_FRACTION * h;
    let walkPhase = 0;
    let lastTime = model.timeProperty.value;
    model.timeProperty.link((time) => {
      const dt = time - lastTime;
      lastTime = time;
      // Only advance the stride for forward play (ignore rewinds / scrubs / resets).
      if (dt > 0 && dt < 0.5) {
        const speedFraction = Math.min(Math.abs(man.velocityProperty.value) / WALK_REF_SPEED, 1);
        walkPhase += dt * WALK_CADENCE;
        const rise = speedFraction * maxBob * Math.abs(Math.sin(walkPhase));
        figure.y = -rise;
        // The shadow tightens as he springs up off the ground.
        const shadowScale = 1 - 0.4 * (rise / maxBob || 0);
        shadow.setScaleMagnitude(shadowScale, shadowScale);
      } else {
        walkPhase = 0;
        figure.y = 0;
        shadow.setScaleMagnitude(1, 1);
      }
    });

    // ── Crash: lean on a wall hit, then ease back upright ─────────────────────────
    let crashAnimation: Animation | null = null;
    man.collideEmitter.addListener(() => {
      crashAnimation?.stop();
      figure.rotation = man.positionProperty.value >= 0 ? CRASH_LEAN : -CRASH_LEAN;
      crashAnimation = new Animation({
        setValue: (r: number) => {
          figure.rotation = r;
        },
        getValue: () => figure.rotation,
        to: 0,
        duration: CRASH_DURATION,
        easing: Easing.CUBIC_OUT,
      });
      crashAnimation.start();
    });

    // Picking the man up (pointer or keyboard) drives him from position and, on the Charts
    // screen, starts recording over the current cursor and begins playing.
    const startPositionDrive = (): void => {
      man.setPositionDriven();
      model.takeControlFromPlayback();
      if (!model.isPlayingProperty.value) {
        model.play();
      }
    };

    this.addInputListener(
      new RichDragListener({
        dragListenerOptions: {
          start: startPositionDrive,
          drag: (event) => {
            const localX = this.globalToParentPoint(event.pointer.point).x;
            man.setMousePosition(transform.viewToModelX(localX));
            man.setPositionDriven();
          },
        },
        keyboardDragListenerOptions: {
          keyboardDragDirection: "leftRight",
          dragDelta: 6,
          shiftDragDelta: 2,
          dragSpeed: 300,
          shiftDragSpeed: 120,
          start: startPositionDrive,
          drag: (_event, listener) => {
            man.setPositionDriven();
            man.setMousePosition(man.getMousePosition() + listener.modelDelta.x / transform.pixelsPerMeter);
          },
        },
      }),
    );
  }

  /** Lay the (possibly zero-length) arrow horizontally from the man's center. */
  private static updateArrow(arrow: ArrowNode, value: number, scale: number, ppm: number, y: number): void {
    const length = Math.abs(value) * scale * ppm;
    if (length < 1) {
      arrow.setTailAndTip(0, y, 0, y);
    } else {
      arrow.setTailAndTip(0, y, Math.sign(value) * length, y);
    }
  }
}
