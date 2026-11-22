import * as stylex from "@stylexjs/stylex";
import { tokens } from "../shared/styles/tokens.stylex";

export const layoutStyles = stylex.create({
  body: {
    backgroundColor: tokens.surface,
    color: tokens.onSurface,
    accentColor: tokens.primary,
  },
  skipLink: {
    position: "fixed",
    top: "1rem",
    insetInlineStart: "1rem",
    zIndex: 100,
    display: "inline-flex",
    alignItems: "center",
    width: { default: "1px", ":focus-visible": "auto", ":active": "auto" },
    height: { default: "1px", ":focus-visible": "auto", ":active": "auto" },
    minHeight: { default: 0, ":focus-visible": "2.75rem", ":active": "2.75rem" },
    margin: { default: "-1px", ":focus-visible": 0, ":active": 0 },
    paddingBlock: { default: 0, ":focus-visible": "0.625rem", ":active": "0.625rem" },
    paddingInline: { default: 0, ":focus-visible": "1rem", ":active": "1rem" },
    overflow: { default: "hidden", ":focus-visible": "visible", ":active": "visible" },
    whiteSpace: { default: "nowrap", ":focus-visible": "normal", ":active": "normal" },
    clipPath: { default: "inset(50%)", ":focus-visible": "none", ":active": "none" },
    borderRadius: tokens.cornerMedium,
    backgroundColor: tokens.primary,
    color: tokens.onPrimary,
    fontSize: "0.875rem",
    fontWeight: 600,
    textDecoration: "none",
    outline: { default: "none", ":focus-visible": `3px solid ${tokens.onSurface}` },
    outlineOffset: "2px",
  },
});
