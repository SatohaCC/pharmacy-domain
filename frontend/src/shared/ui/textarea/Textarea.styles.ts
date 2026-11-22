import * as stylex from "@stylexjs/stylex";
import { tokens } from "../../styles/tokens.stylex";

const FORCED_COLORS = "@media (forced-colors: active)";

export const textareaStyles = stylex.create({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: "0.375rem",
    width: "100%",
    minWidth: 0,
  },
  label: {
    fontSize: "0.875rem",
    lineHeight: 1.43,
    fontWeight: 500,
    letterSpacing: "0.00625rem",
    color: tokens.onSurfaceVariant,
    cursor: "pointer",
    alignSelf: "flex-start",
  },
  labelInvalid: {
    color: tokens.error,
  },
  labelDisabled: {
    color: tokens.disabledContent,
    cursor: "not-allowed",
  },
  requiredMark: {
    color: tokens.error,
    marginInlineStart: "0.25rem",
  },
  controlBox: {
    display: "flex",
    alignItems: "flex-start",
    width: "100%",
    minWidth: 0,
    minHeight: "5.5rem",
    paddingInline: "1rem",
    paddingBlock: "0.875rem",
    color: tokens.onSurface,
    cursor: "text",
    outline: { default: "none", ":focus-within": `3px solid ${tokens.primary}` },
    outlineOffset: 2,
    transitionProperty: "background-color, box-shadow",
    transitionDuration: tokens.motionDuration,
    transitionTimingFunction: tokens.motionEasing,
  },
  outlined: {
    backgroundColor: "transparent",
    borderRadius: tokens.cornerExtraSmall,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: {
      default: tokens.outline,
      "@media (hover: hover)": { ":hover": tokens.onSurface },
      ":focus-within": tokens.primary,
    },
    boxShadow: {
      default: "none",
      ":focus-within": `inset 0 0 0 1px ${tokens.primary}`,
    },
  },
  outlinedInvalid: {
    borderColor: {
      default: tokens.error,
      "@media (hover: hover)": { ":hover": tokens.error },
      ":focus-within": tokens.error,
    },
    boxShadow: {
      default: "none",
      ":focus-within": `inset 0 0 0 1px ${tokens.error}`,
    },
  },
  outlinedDisabled: {
    cursor: "not-allowed",
    borderColor: {
      default: tokens.disabledContainer,
      "@media (hover: hover)": { ":hover": tokens.disabledContainer },
      ":focus-within": tokens.disabledContainer,
    },
    boxShadow: {
      default: "none",
      ":focus-within": "none",
    },
  },
  filled: {
    backgroundColor: tokens.surfaceContainerHighest,
    borderStartStartRadius: tokens.cornerExtraSmall,
    borderStartEndRadius: tokens.cornerExtraSmall,
    borderEndStartRadius: tokens.cornerNone,
    borderEndEndRadius: tokens.cornerNone,
    borderWidth: { default: 0, [FORCED_COLORS]: 1 },
    borderStyle: { default: "none", [FORCED_COLORS]: "solid" },
    borderColor: {
      default: "transparent",
      [FORCED_COLORS]: { default: "CanvasText", ":focus-within": "Highlight" },
    },
    boxShadow: {
      default: `inset 0 -1px 0 0 ${tokens.onSurfaceVariant}`,
      "@media (hover: hover)": { ":hover": `inset 0 -1px 0 0 ${tokens.onSurface}` },
      ":focus-within": `inset 0 -2px 0 0 ${tokens.primary}`,
    },
    backgroundImage: {
      default: "none",
      "@media (hover: hover)": { ":hover": tokens.stateHover },
      ":focus-within": "none",
    },
  },
  filledInvalid: {
    boxShadow: {
      default: `inset 0 -1px 0 0 ${tokens.error}`,
      "@media (hover: hover)": { ":hover": `inset 0 -1px 0 0 ${tokens.error}` },
      ":focus-within": `inset 0 -2px 0 0 ${tokens.error}`,
    },
  },
  filledDisabled: {
    backgroundColor: tokens.disabledContainer,
    cursor: "not-allowed",
    borderColor: { default: "transparent", [FORCED_COLORS]: "GrayText" },
    boxShadow: {
      default: `inset 0 -1px 0 0 ${tokens.disabledContent}`,
      "@media (hover: hover)": { ":hover": `inset 0 -1px 0 0 ${tokens.disabledContent}` },
      ":focus-within": `inset 0 -1px 0 0 ${tokens.disabledContent}`,
    },
    backgroundImage: {
      default: "none",
      "@media (hover: hover)": { ":hover": "none" },
    },
  },
  input: {
    flex: 1,
    minWidth: 0,
    width: "100%",
    minHeight: "3.75rem",
    maxHeight: "18rem",
    resize: "vertical",
    borderWidth: 0,
    backgroundColor: "transparent",
    color: tokens.onSurface,
    fontFamily: "inherit",
    fontSize: "max(1rem, 1em)",
    lineHeight: 1.5,
    letterSpacing: "0.03125rem",
    outline: "none",
    "::placeholder": {
      color: tokens.onSurfaceVariant,
      opacity: 1,
    },
  },
  inputAutoResize: {
    resize: "none",
  },
  inputDisabled: {
    color: tokens.disabledContent,
    cursor: "not-allowed",
    "::placeholder": {
      color: tokens.disabledContent,
      opacity: 1,
    },
  },
  supporting: {
    fontSize: "0.75rem",
    lineHeight: 1.35,
    letterSpacing: "0.025rem",
    color: tokens.onSurfaceVariant,
    paddingInline: "0.25rem",
  },
  supportingDisabled: {
    color: tokens.disabledContent,
  },
  error: {
    fontSize: "0.75rem",
    lineHeight: 1.35,
    letterSpacing: "0.025rem",
    color: tokens.error,
    paddingInline: "0.25rem",
  },
});
