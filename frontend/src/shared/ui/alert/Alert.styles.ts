import * as stylex from "@stylexjs/stylex";
import { tokens } from "../../styles/tokens.stylex";

export const alertStyles = stylex.create({
  root: {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.75rem",
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    paddingBlock: "0.875rem",
    paddingInline: "1rem",
    borderRadius: tokens.cornerMedium,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.outlineVariant,
  },
  info: {
    backgroundColor: tokens.tertiaryContainer,
    color: tokens.onTertiaryContainer,
  },
  success: {
    backgroundColor: tokens.successContainer,
    color: tokens.onSuccessContainer,
  },
  warning: {
    backgroundColor: tokens.warningContainer,
    color: tokens.onWarningContainer,
  },
  error: {
    backgroundColor: tokens.errorContainer,
    color: tokens.onErrorContainer,
  },
  iconWrap: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: "1.25rem",
    height: "1.375rem",
  },
  icon: {
    width: "1.25rem",
    height: "1.25rem",
  },
  body: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
  },
  title: {
    fontSize: "0.9375rem",
    lineHeight: 1.47,
    fontWeight: 600,
    overflowWrap: "anywhere",
  },
  message: {
    fontSize: "0.875rem",
    lineHeight: 1.55,
    overflowWrap: "anywhere",
  },
  controls: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "0.5rem",
    flexShrink: 0,
  },
  dismissButton: {
    appearance: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: "2.75rem",
    height: "2.75rem",
    margin: "-0.375rem",
    borderWidth: 0,
    borderRadius: tokens.cornerFull,
    backgroundColor: "transparent",
    color: "inherit",
    cursor: "pointer",
    outline: { default: "none", ":focus-visible": `3px solid ${tokens.primary}` },
    outlineOffset: 2,
    backgroundImage: {
      default: "none",
      ":focus-visible": tokens.stateFocus,
      "@media (hover: hover)": { ":hover": tokens.stateHover },
      ":active": tokens.statePress,
    },
  },
  dismissIcon: {
    width: "1.125rem",
    height: "1.125rem",
  },
});
