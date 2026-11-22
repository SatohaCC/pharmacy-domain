import * as stylex from "@stylexjs/stylex";
import { tokens } from "../src/shared/styles/tokens.stylex";

export const previewStyles = stylex.create({
  surface: {
    backgroundColor: tokens.surface,
    color: tokens.onSurface,
    minHeight: "100dvh",
    padding: "1.5rem",
  },
});
