import * as stylex from "@stylexjs/stylex";
import { tokens } from "./tokens.stylex";

export const themeOverrideStoryStyles = stylex.create({
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))",
    gap: "1rem",
    width: "100%",
  },
  panel: {
    display: "flex",
    flexDirection: "column",
    gap: "0.875rem",
    padding: "1.25rem",
    borderRadius: tokens.cornerLarge,
    border: `1px solid ${tokens.outlineVariant}`,
    backgroundColor: tokens.surfaceContainerLow,
    color: tokens.onSurface,
  },
  heading: {
    fontSize: "0.9375rem",
    fontWeight: 700,
    color: tokens.onSurface,
  },
  row: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "0.625rem",
  },
});
