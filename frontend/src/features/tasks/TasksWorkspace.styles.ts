import * as stylex from "@stylexjs/stylex";
import { tokens } from "../../shared/styles/tokens.stylex";

const stacked = "@media (max-width: 56.25em)";
const mobile = "@media (max-width: 37.5em)";

export const tasksWorkspaceStyles = stylex.create({
  layout: {
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(0, 22rem) minmax(0, 1fr)",
      [stacked]: "minmax(0, 1fr)",
    },
    alignItems: "start",
    gap: "1.5rem",
    minWidth: 0,
  },
  listColumn: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    minWidth: 0,
  },
  filterCard: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    paddingBlock: "1.25rem",
    paddingInline: "1.25rem",
    borderRadius: tokens.cornerLarge,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.outlineVariant,
    backgroundColor: tokens.surfaceContainerLow,
    minWidth: 0,
  },
  filterGrid: {
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(0, 14rem) minmax(0, 1fr)",
      [mobile]: "minmax(0, 1fr)",
    },
    gap: "1rem",
    alignItems: "end",
  },
  summaryBar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.75rem",
  },
  summaryLeft: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.75rem",
  },
  summaryTitle: {
    fontSize: "1.125rem",
    lineHeight: 1.45,
    fontWeight: 700,
    color: tokens.onSurface,
  },
  countBadge: {
    fontVariantNumeric: "tabular-nums",
  },
  summaryActions: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "0.5rem",
  },
});
