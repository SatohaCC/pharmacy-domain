import * as stylex from "@stylexjs/stylex";
import { tokens } from "../../styles/tokens.stylex";

const FORCED_COLORS = "@media (forced-colors: active)";

export const tooltipStyles = stylex.create({
  content: {
    zIndex: 60,
    margin: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: "0.5rem",
    maxWidth: "min(calc(100dvw - 1.5rem), 18rem)",
    paddingBlock: "0.375rem",
    paddingInline: "0.625rem",
    borderWidth: { default: 0, [FORCED_COLORS]: 1 },
    borderStyle: { default: "none", [FORCED_COLORS]: "solid" },
    borderColor: { default: "transparent", [FORCED_COLORS]: "CanvasText" },
    borderRadius: tokens.cornerExtraSmall,
    backgroundColor: tokens.inverseSurface,
    color: tokens.inverseOnSurface,
    boxShadow: tokens.shadow1,
    fontSize: "0.75rem",
    lineHeight: 1.35,
    fontWeight: 500,
    overflowWrap: "anywhere",
    transitionProperty: "opacity, transform",
    transitionDuration: tokens.motionDuration,
    transitionTimingFunction: tokens.motionEasing,
  },
  shortcut: {
    opacity: 0.85,
    fontFamily: "monospace",
    fontSize: "0.6875rem",
    flexShrink: 0,
  },
});
