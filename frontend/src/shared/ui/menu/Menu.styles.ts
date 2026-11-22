import * as stylex from "@stylexjs/stylex";
import { tokens } from "../../styles/tokens.stylex";

export const menuStyles = stylex.create({
  content: {
    zIndex: 55,
    margin: 0,
    minWidth: "12rem",
    maxWidth: "min(calc(100dvw - 1.5rem), 22rem)",
    maxHeight: "var(--available-height, 20rem)",
    overflowY: "auto",
    overscrollBehavior: "contain",
    paddingBlock: "0.5rem",
    paddingInline: 0,
    borderRadius: tokens.cornerMedium,
    backgroundColor: tokens.surfaceContainer,
    color: tokens.onSurface,
    boxShadow: tokens.shadow2,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.outlineVariant,
    outline: "none",
  },
  item: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
    minHeight: "2.75rem",
    paddingInline: "1rem",
    paddingBlock: "0.5rem",
    fontSize: "0.9375rem",
    lineHeight: 1.47,
    color: tokens.onSurface,
    cursor: "pointer",
    outline: "none",
    userSelect: "none",
  },
  itemHighlighted: {
    backgroundImage: tokens.stateHover,
    outline: "2px solid transparent",
    outlineOffset: -2,
  },
  itemDestructive: {
    color: tokens.error,
  },
  itemDisabled: {
    color: tokens.disabledContent,
    cursor: "not-allowed",
    backgroundImage: "none",
  },
  itemLabel: {
    minWidth: 0,
    overflowWrap: "anywhere",
  },
  separator: {
    height: 1,
    marginBlock: "0.375rem",
    backgroundColor: tokens.outlineVariant,
  },
});
