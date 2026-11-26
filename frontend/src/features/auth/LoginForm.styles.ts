import * as stylex from "@stylexjs/stylex";
import { tokens } from "../../shared/styles/tokens.stylex";

export const loginFormStyles = stylex.create({
  shell: {
    minHeight: "100dvh",
    display: "grid",
    placeItems: "center",
    paddingBlock: "32px",
    paddingInline: "20px",
    backgroundColor: tokens.surface,
    color: tokens.onSurface,
  },
  card: {
    width: "100%",
    maxWidth: "460px",
    display: "grid",
    gap: "20px",
    padding: "28px",
    borderRadius: tokens.cornerExtraLarge,
    backgroundColor: tokens.surfaceContainerLow,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: tokens.outlineVariant,
    boxShadow: tokens.shadow1,
    "@media (max-width: 480px)": {
      padding: "20px",
      borderRadius: tokens.cornerLarge,
    },
  },
  header: {
    display: "grid",
    gap: "8px",
  },
  eyebrow: {
    margin: 0,
    fontSize: "0.75rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    color: tokens.primary,
  },
  title: {
    margin: 0,
    fontSize: "1.5rem",
    lineHeight: 1.3,
    fontWeight: 700,
    color: tokens.onSurface,
  },
  subtitle: {
    margin: 0,
    fontSize: "0.875rem",
    lineHeight: 1.5,
    color: tokens.onSurfaceVariant,
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
