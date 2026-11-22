import * as stylex from "@stylexjs/stylex";
import { tokens } from "../../shared/styles/tokens.stylex";

export const taskListStyles = stylex.create({
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    minWidth: 0,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  item: {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.875rem",
    paddingBlock: "1rem",
    paddingInline: "1.125rem",
    borderRadius: tokens.cornerLarge,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.outlineVariant,
    backgroundColor: tokens.surfaceContainerLow,
    minWidth: 0,
  },
  itemDeferred: {
    contentVisibility: "auto",
    containIntrinsicSize: "auto none auto 5.25rem",
  },
  checkboxWrap: {
    flexShrink: 0,
    paddingTop: "0.0625rem",
  },
  content: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "0.375rem",
  },
  titleRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "0.5rem",
    minWidth: 0,
  },
  title: {
    fontSize: "1rem",
    lineHeight: 1.5,
    fontWeight: 600,
    color: tokens.onSurface,
    overflowWrap: "anywhere",
  },
  titleDone: {
    textDecorationLine: "line-through",
    color: tokens.onSurfaceVariant,
  },
  badges: {
    display: "inline-flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "0.375rem",
  },
  description: {
    fontSize: "0.875rem",
    lineHeight: 1.65,
    color: tokens.onSurfaceVariant,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    textWrap: "pretty",
  },
  actions: {
    flexShrink: 0,
  },
  loadingWrap: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
});
