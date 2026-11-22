import * as stylex from "@stylexjs/stylex";
import { tokens } from "../../styles/tokens.stylex";

export const toastStoryStyles = stylex.create({
  controls: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.75rem",
    minHeight: "6rem",
    alignItems: "flex-start",
  },
  stage: {
    minHeight: "7rem",
    padding: "1rem",
    borderRadius: tokens.cornerMedium,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.outlineVariant,
    backgroundColor: tokens.surfaceContainerLow,
    color: tokens.onSurfaceVariant,
    fontSize: "0.875rem",
  },
});
