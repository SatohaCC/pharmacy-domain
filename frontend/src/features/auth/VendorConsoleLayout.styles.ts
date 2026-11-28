import * as stylex from "@stylexjs/stylex";
import { tokens } from "../../shared/styles/tokens.stylex";

export const vendorConsoleLayoutStyles = stylex.create({
  page: {
    minHeight: "100dvh",
    backgroundColor: tokens.pageBackground,
    color: tokens.onSurface,
    paddingBlock: "clamp(1rem, 3vw, 2rem) 3rem",
    paddingInline: "clamp(1rem, 4vw, 3rem)",
  },
  container: {
    width: "100%",
    maxWidth: "90rem",
    marginInline: "auto",
    display: "grid",
    gap: "1.5rem",
  },
  panels: {
    display: "grid",
    alignItems: "start",
    gap: "clamp(1rem, 2vw, 1.5rem)",
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      "@media (min-width: 75rem)": "minmax(0, 5fr) minmax(0, 7fr)",
    },
  },
  panel: {
    display: "grid",
    minWidth: 0,
    gap: "1.125rem",
    padding: { default: "1.5rem", "@media (max-width: 30rem)": "1.125rem" },
    borderRadius: tokens.cornerLarge,
    backgroundColor: tokens.surfaceContainerLow,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: tokens.outlineVariant,
  },
  panelHeading: {
    margin: 0,
    fontSize: "1.375rem",
    lineHeight: 1.27,
    fontWeight: 500,
    color: tokens.onSurface,
  },
});
