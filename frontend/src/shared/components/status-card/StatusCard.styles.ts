import * as stylex from "@stylexjs/stylex";
import { tokens } from "../../styles/tokens.stylex";

export const statusCardStyles = stylex.create({
  root: { display: "flex", flexDirection: "column", gap: "1.5rem", minWidth: 0 },
  row: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "0.75rem",
    borderRadius: tokens.cornerLarge,
    backgroundColor: tokens.surfaceContainer,
    paddingBlock: "1.25rem",
    paddingInline: "1.25rem",
    minWidth: 0,
  },
  label: {
    fontSize: "0.875rem",
    lineHeight: 1.43,
    fontWeight: 500,
    color: tokens.onSurfaceVariant,
  },
});
