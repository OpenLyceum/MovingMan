import { Color, ProfileColorProperty } from "scenerystack/scenery";
import MovingManNamespace from "./MovingManNamespace.js";

const { BLACK, WHITE } = Color;

// ── Sky / ground scenery ──────────────────────────────────────────────────────
// The original sim paints a blue sky gradient over a green ground. In projector
// mode the scene flattens to white sky / pale ground for maximum contrast.
const SKY_TOP_DEFAULT = new Color(120, 192, 240);
const SKY_BOTTOM_DEFAULT = new Color(206, 233, 250);
const GROUND_DEFAULT = new Color(110, 178, 92);

// ── Panel fills ───────────────────────────────────────────────────────────────
const PANEL_FILL_DEFAULT = new Color(245, 245, 245);
const PANEL_FILL_PROJECTOR = WHITE;
const PANEL_STROKE = "rgba(0, 0, 0, 0.35)";

const MovingManColors = {
  backgroundColorProperty: new ProfileColorProperty(MovingManNamespace, "background", {
    default: SKY_BOTTOM_DEFAULT,
    projector: WHITE,
  }),
  foregroundColorProperty: new ProfileColorProperty(MovingManNamespace, "foreground", {
    default: BLACK,
    projector: BLACK,
  }),

  skyTopProperty: new ProfileColorProperty(MovingManNamespace, "skyTop", {
    default: SKY_TOP_DEFAULT,
    projector: WHITE,
  }),
  skyBottomProperty: new ProfileColorProperty(MovingManNamespace, "skyBottom", {
    default: SKY_BOTTOM_DEFAULT,
    projector: WHITE,
  }),
  groundProperty: new ProfileColorProperty(MovingManNamespace, "ground", {
    default: GROUND_DEFAULT,
    projector: new Color(225, 235, 225),
  }),
  groundStrokeProperty: new ProfileColorProperty(MovingManNamespace, "groundStroke", {
    default: new Color(70, 120, 60),
    projector: new Color(120, 120, 120),
  }),

  panelFillProperty: new ProfileColorProperty(MovingManNamespace, "panelFill", {
    default: PANEL_FILL_DEFAULT,
    projector: PANEL_FILL_PROJECTOR,
  }),
  panelStrokeProperty: new ProfileColorProperty(MovingManNamespace, "panelStroke", {
    default: PANEL_STROKE,
    projector: PANEL_STROKE,
  }),

  // The three kinematic quantities. The hues match the original sim's graph lines.
  positionProperty: new ProfileColorProperty(MovingManNamespace, "position", {
    default: "#2575BA",
    projector: "#2575BA",
  }),
  velocityProperty: new ProfileColorProperty(MovingManNamespace, "velocity", {
    default: "#CD2520",
    projector: "#CD2520",
  }),
  accelerationProperty: new ProfileColorProperty(MovingManNamespace, "acceleration", {
    default: "#349E34",
    projector: "#349E34",
  }),

  // The man figure.
  manFillProperty: new ProfileColorProperty(MovingManNamespace, "manFill", {
    default: "#3a78c9",
    projector: "#2c5fa8",
  }),
  manSkinProperty: new ProfileColorProperty(MovingManNamespace, "manSkin", {
    default: "#f2c9a0",
    projector: "#f2c9a0",
  }),
  manStrokeProperty: new ProfileColorProperty(MovingManNamespace, "manStroke", { default: BLACK, projector: BLACK }),
  manShadowProperty: new ProfileColorProperty(MovingManNamespace, "manShadow", {
    default: "rgba(0,0,0,0.22)",
    projector: "rgba(0,0,0,0.15)",
  }),

  // Brick walls at the ends of the track (brick + mortar between courses). The highlight is
  // the soft top-of-course sheen painted over each brick.
  wallFillProperty: new ProfileColorProperty(MovingManNamespace, "wallFill", {
    default: "#b5532c",
    projector: "#b5532c",
  }),
  wallMortarProperty: new ProfileColorProperty(MovingManNamespace, "wallMortar", {
    default: "#e3c7a6",
    projector: "#e3c7a6",
  }),
  wallStrokeProperty: new ProfileColorProperty(MovingManNamespace, "wallStroke", {
    default: new Color(90, 40, 20),
    projector: new Color(90, 40, 20),
  }),
  wallBrickHighlightProperty: new ProfileColorProperty(MovingManNamespace, "wallBrickHighlight", {
    default: "rgba(255,255,255,0.18)",
    projector: "rgba(255,255,255,0.18)",
  }),

  // Translucent pill behind the play-area clock readout, for legibility over the sky gradient.
  clockReadoutBackgroundProperty: new ProfileColorProperty(MovingManNamespace, "clockReadoutBackground", {
    default: "rgba(255,255,255,0.7)",
    projector: WHITE,
  }),

  // Charts.
  chartBackgroundProperty: new ProfileColorProperty(MovingManNamespace, "chartBackground", {
    default: WHITE,
    projector: WHITE,
  }),
  chartGridProperty: new ProfileColorProperty(MovingManNamespace, "chartGrid", {
    default: new Color(220, 220, 220),
    projector: new Color(220, 220, 220),
  }),
  chartBorderProperty: new ProfileColorProperty(MovingManNamespace, "chartBorder", {
    default: new Color(120, 120, 120),
    projector: new Color(120, 120, 120),
  }),
  chartCursorProperty: new ProfileColorProperty(MovingManNamespace, "chartCursor", {
    default: "rgba(0,0,0,0.45)",
    projector: "rgba(0,0,0,0.45)",
  }),

  // Fleet-standard aliases for shared Panel + ButtonOptions modules.
  panelBackgroundColorProperty: new ProfileColorProperty(MovingManNamespace, "panelBackground", {
    default: PANEL_FILL_DEFAULT,
    projector: PANEL_FILL_PROJECTOR,
  }),
  panelBorderColorProperty: new ProfileColorProperty(MovingManNamespace, "panelBorder", {
    default: PANEL_STROKE,
    projector: PANEL_STROKE,
  }),
  textColorProperty: new ProfileColorProperty(MovingManNamespace, "text", { default: BLACK, projector: BLACK }),

  // ── Light control surfaces ───────────────────────────────────────────────────
  // White chrome (combo boxes, flat push buttons, editable input fields) stays light
  // in both profiles; its text stays dark.

  /** Fill of light control surfaces: combo-box button/list, editable input fields. */
  controlSurfaceColorProperty: new ProfileColorProperty(MovingManNamespace, "controlSurface", {
    default: "#ffffff",
    projector: "#ffffff",
  }),

  /** Fill of a disabled control surface (grayed-out editable input field). */
  controlSurfaceDisabledColorProperty: new ProfileColorProperty(MovingManNamespace, "controlSurfaceDisabled", {
    default: "#cccccc",
    projector: "#cccccc",
  }),

  /** Text on light control surfaces: combo items, flat-button labels, field values, preferences. */
  controlSurfaceTextColorProperty: new ProfileColorProperty(MovingManNamespace, "controlSurfaceText", {
    default: "#1a1a1a",
    projector: "#1a1a1a",
  }),
};

export default MovingManColors;
