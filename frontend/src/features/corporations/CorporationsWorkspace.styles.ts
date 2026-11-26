import * as stylex from "@stylexjs/stylex";
import { tokens } from "../../shared/styles/tokens.stylex";

export const corporationsWorkspaceStyles = stylex.create({
  loadingBox: {
    minHeight: "60dvh",
    display: "grid",
    placeItems: "center",
  },
  sectionHeader: {
    display: "grid",
    gap: "6px",
  },
  sectionDescription: {
    margin: 0,
    fontSize: "0.875rem",
    lineHeight: 1.5,
    color: tokens.onSurfaceVariant,
  },
  refreshStatus: {
    minBlockSize: "1.5em",
  },
  formStack: {
    display: "grid",
    gap: "16px",
  },
  formGrid: {
    display: "grid",
    gap: "16px",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 14rem), 1fr))",
  },
  searchGrid: {
    display: "grid",
    gap: "16px",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 13rem), 1fr))",
  },
  submitRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "10px",
  },
  corpList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "grid",
    gap: "12px",
  },
  corpItem: {
    display: "grid",
    gap: "14px",
    padding: "16px",
    borderRadius: tokens.cornerMedium,
    backgroundColor: tokens.surfaceContainerLowest,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: tokens.outlineVariant,
  },
  corpItemHeader: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
  },
  corpMainInfo: {
    display: "grid",
    gap: "6px",
    minWidth: 0,
  },
  corpTitleRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
  },
  corpName: {
    margin: 0,
    fontSize: "1rem",
    fontWeight: 700,
    color: tokens.onSurface,
    overflowWrap: "anywhere",
  },
  metaGrid: {
    margin: 0,
    display: "flex",
    flexWrap: "wrap",
    gap: "8px 16px",
    fontSize: "0.8125rem",
    color: tokens.onSurfaceVariant,
  },
  metaCode: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  editPanel: {
    display: "grid",
    gap: "16px",
    padding: "16px",
    borderRadius: tokens.cornerMedium,
    backgroundColor: tokens.surfaceContainer,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: tokens.outlineVariant,
  },
  editTitle: {
    margin: 0,
    fontSize: "0.9375rem",
    fontWeight: 700,
    color: tokens.onSurface,
  },
  emptyState: {
    margin: 0,
    padding: "20px",
    textAlign: "center",
    fontSize: "0.875rem",
    color: tokens.onSurfaceVariant,
  },
});
