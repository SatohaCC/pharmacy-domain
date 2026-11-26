import * as stylex from "@stylexjs/stylex";
import { tokens } from "../../shared/styles/tokens.stylex";

export const loginFormStyles = stylex.create({
  shell: {
    minHeight: "100dvh",
    display: "grid",
    placeItems: "center",
    paddingBlock: "clamp(1rem, 5dvh, 3rem)",
    paddingInline: "clamp(1rem, 4vw, 3rem)",
    backgroundColor: tokens.surface,
    color: tokens.onSurface,
  },
  card: {
    width: "100%",
    maxWidth: {
      default: "30rem",
      "@media (min-width: 56rem)": "66rem",
    },
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      "@media (min-width: 56rem)": "minmax(0, 1.05fr) minmax(0, 1fr)",
    },
    gap: "clamp(1rem, 3vw, 2.5rem)",
    padding: "clamp(0.75rem, 1.8vw, 1.75rem)",
    borderRadius: tokens.cornerExtraLarge,
    backgroundColor: tokens.surfaceContainerLow,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: tokens.outlineVariant,
    boxShadow: tokens.shadow1,
  },
  header: {
    display: "grid",
    alignContent: "center",
    gap: "0.75rem",
    padding: "clamp(1.25rem, 4vw, 3rem)",
    borderRadius: tokens.cornerLarge,
    backgroundColor: tokens.primaryContainer,
    color: tokens.onPrimaryContainer,
  },
  content: {
    minWidth: 0,
    display: "grid",
    alignContent: "center",
    gap: "1.25rem",
    padding: "clamp(0.5rem, 1.8vw, 1.5rem)",
  },
  title: {
    margin: 0,
    fontSize: "clamp(1.5rem, 1.1rem + 1vw, 2rem)",
    lineHeight: 1.25,
    fontWeight: 500,
  },
  subtitle: {
    margin: 0,
    fontSize: "1rem",
    lineHeight: 1.5,
  },
  form: {
    display: "grid",
    gap: "16px",
  },
  errorDetails: {
    margin: 0,
    fontSize: "0.875rem",
    lineHeight: 1.5,
  },
  errorHint: {
    marginTop: "6px",
    marginBottom: 0,
    fontSize: "0.8125rem",
    lineHeight: 1.5,
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    paddingTop: "4px",
  },
  submitButton: {
    flexGrow: 1,
  },
  footerNote: {
    margin: 0,
    paddingTop: "12px",
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: tokens.outlineVariant,
    fontSize: "0.8125rem",
    lineHeight: 1.5,
    color: tokens.onSurfaceVariant,
  },
  backLink: {
    color: tokens.primary,
    fontWeight: 600,
    fontSize: "0.875rem",
    textDecoration: "none",
    ":hover": {
      textDecoration: "underline",
    },
    ":focus-visible": {
      outline: `3px solid ${tokens.primary}`,
      outlineOffset: "3px",
      borderRadius: tokens.cornerExtraSmall,
    },
  },
});
