import * as stylex from "@stylexjs/stylex";
import { tokens } from "../../shared/styles/tokens.stylex";

export const taskCreateFormStyles = stylex.create({
  card: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    paddingBlock: "1.5rem",
    paddingInline: "1.5rem",
    borderRadius: tokens.cornerLarge,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.outlineVariant,
    backgroundColor: tokens.surfaceContainerLow,
  },
  header: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
  },
  heading: {
    fontSize: "1.125rem",
    lineHeight: 1.45,
    fontWeight: 700,
    color: tokens.onSurface,
  },
  requiredNote: {
    fontSize: "0.8125rem",
    lineHeight: 1.54,
    color: tokens.onSurfaceVariant,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    paddingTop: "0.25rem",
  },
});
