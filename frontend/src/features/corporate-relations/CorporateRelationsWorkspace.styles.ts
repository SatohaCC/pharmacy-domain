import * as stylex from "@stylexjs/stylex";
import { tokens } from "../../shared/styles/tokens.stylex";

export const corporateRelationsWorkspaceStyles = stylex.create({
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
  formStack: {
    display: "grid",
    gap: "16px",
  },
  formGrid: {
    display: "grid",
    gap: "16px",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 14rem), 1fr))",
  },
  submitRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "10px",
  },
  relationList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "grid",
    gap: "12px",
  },
  relationItem: {
    display: "grid",
    gap: "14px",
    padding: "16px",
    borderRadius: tokens.cornerMedium,
    backgroundColor: tokens.surfaceContainerLowest,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: tokens.outlineVariant,
  },
  itemHeader: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
  },
  itemMainInfo: {
    display: "grid",
    gap: "6px",
    minWidth: 0,
  },
  titleRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
  },
  relationTitle: {
    margin: 0,
    fontSize: "1rem",
    fontWeight: 700,
    color: tokens.onSurface,
  },
  metaGrid: {
    margin: 0,
    display: "flex",
    flexWrap: "wrap",
    gap: "8px 16px",
    fontSize: "0.8125rem",
    color: tokens.onSurfaceVariant,
  },
  actionRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  panelBox: {
    display: "grid",
    gap: "16px",
    padding: "16px",
    borderRadius: tokens.cornerMedium,
    backgroundColor: tokens.surfaceContainer,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: tokens.outlineVariant,
  },
  subTitle: {
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
