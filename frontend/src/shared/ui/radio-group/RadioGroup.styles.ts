import * as stylex from "@stylexjs/stylex";
import { tokens } from "../../styles/tokens.stylex";

const COARSE_POINTER = "@media (pointer: coarse)";
const FORCED_COLORS = "@media (forced-colors: active)";

export const radioGroupStyles = stylex.create({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    width: "100%",
    minWidth: 0,
  },
  standaloneRoot: {
    display: "inline-flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  groupLabel: {
    fontSize: "0.875rem",
    lineHeight: 1.43,
    fontWeight: 500,
    letterSpacing: "0.00625rem",
    color: tokens.onSurfaceVariant,
  },
  groupLabelInvalid: {
    color: tokens.error,
  },
  groupLabelDisabled: {
    color: tokens.disabledContent,
  },
  requiredMark: {
    color: tokens.error,
    marginInlineStart: "0.25rem",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    minWidth: 0,
  },
  listHorizontal: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: "0.75rem 1.25rem",
  },
  itemField: {
    display: "flex",
    alignItems: "flex-start",
    gap: 0,
    minWidth: 0,
  },
  control: {
    appearance: "none",
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: { default: "2.5rem", [COARSE_POINTER]: "2.75rem" },
    height: { default: "2.5rem", [COARSE_POINTER]: "2.75rem" },
    margin: { default: "-0.375rem", [COARSE_POINTER]: "-0.5rem" },
    padding: 0,
    borderWidth: 0,
    borderRadius: tokens.cornerFull,
    backgroundColor: "transparent",
    color: tokens.onSurfaceVariant,
    cursor: "pointer",
    outline: { default: "none", ":focus-visible": `3px solid ${tokens.primary}` },
    outlineOffset: -2,
    backgroundImage: {
      default: "none",
      ":focus-visible": tokens.stateFocus,
      "@media (hover: hover)": { ":hover": tokens.stateHover },
      ":active": tokens.statePress,
    },
  },
  controlChecked: {
    color: tokens.primary,
  },
  controlInvalid: {
    color: tokens.error,
  },
  controlDisabled: {
    cursor: "not-allowed",
    backgroundImage: {
      default: "none",
      ":focus-visible": "none",
      "@media (hover: hover)": { ":hover": "none" },
      ":active": "none",
    },
  },
  ring: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "1.25rem",
    height: "1.25rem",
    borderRadius: tokens.cornerFull,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: tokens.onSurfaceVariant,
    transitionProperty: "border-color",
    transitionDuration: tokens.motionDuration,
    transitionTimingFunction: tokens.motionEasing,
  },
  ringChecked: {
    borderColor: tokens.primary,
  },
  ringInvalid: {
    borderColor: tokens.error,
  },
  ringDisabled: {
    borderColor: { default: tokens.disabledContent, [FORCED_COLORS]: "GrayText" },
  },
  dot: {
    display: "block",
    boxSizing: "border-box",
    width: "0.625rem",
    height: "0.625rem",
    borderRadius: tokens.cornerFull,
    backgroundColor: tokens.primary,
    borderWidth: { default: 0, [FORCED_COLORS]: "0.3125rem" },
    borderStyle: { default: "none", [FORCED_COLORS]: "solid" },
    borderColor: { default: "transparent", [FORCED_COLORS]: "Highlight" },
  },
  dotInvalid: {
    backgroundColor: tokens.error,
  },
  dotDisabled: {
    backgroundColor: tokens.disabledContent,
    borderColor: { default: "transparent", [FORCED_COLORS]: "GrayText" },
  },
  textGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "0.125rem",
    minWidth: 0,
    paddingTop: "0.125rem",
  },
  itemLabel: {
    fontSize: "0.9375rem",
    lineHeight: 1.47,
    fontWeight: 500,
    color: tokens.onSurface,
    cursor: "pointer",
    paddingInlineStart: "0.5rem",
  },
  itemLabelDisabled: {
    color: tokens.disabledContent,
    cursor: "not-allowed",
  },
  itemDescription: {
    fontSize: "0.8125rem",
    lineHeight: 1.54,
    color: tokens.onSurfaceVariant,
    paddingInlineStart: "0.5rem",
  },
  itemDescriptionDisabled: {
    color: tokens.disabledContent,
  },
  supporting: {
    fontSize: "0.75rem",
    lineHeight: 1.35,
    color: tokens.onSurfaceVariant,
  },
  supportingDisabled: {
    color: tokens.disabledContent,
  },
  error: {
    fontSize: "0.75rem",
    lineHeight: 1.35,
    color: tokens.error,
  },
});
