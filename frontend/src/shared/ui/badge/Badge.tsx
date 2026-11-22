import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { badgeStyles } from "./Badge.styles";

export interface BadgeProps {
  tone?: "neutral" | "success" | "danger";
  style?: stylex.StyleXStyles;
  children: ReactNode;
}

export function Badge({ tone = "neutral", style, children }: BadgeProps) {
  return <span {...stylex.props(badgeStyles.base, badgeStyles[tone], style)}>{children}</span>;
}
