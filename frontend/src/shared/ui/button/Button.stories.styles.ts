import * as stylex from "@stylexjs/stylex";
import { tokens } from "../../styles/tokens.stylex";

export const buttonStoryStyles = stylex.create({
  viewport: { overflowX: "auto", maxWidth: "100%" },
  table: { borderCollapse: "separate", borderSpacing: "1.5rem", minWidth: "48rem", width: "100%" },
  heading: {
    color: tokens.onSurfaceVariant,
    fontSize: "0.875rem",
    fontWeight: 500,
    textAlign: "center",
  },
  rowHeading: {
    color: tokens.onSurfaceVariant,
    fontSize: "0.875rem",
    fontWeight: 500,
    textAlign: "start",
    whiteSpace: "nowrap",
  },
  cell: { textAlign: "center", paddingBlock: "1rem" },
});
