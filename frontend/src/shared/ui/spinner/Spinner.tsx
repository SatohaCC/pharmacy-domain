import * as stylex from "@stylexjs/stylex";
import { spinnerStyles as s } from "./Spinner.styles";

export type SpinnerSize = "sm" | "md" | "lg";

interface SpinnerBaseProps {
  size?: SpinnerSize;
  style?: stylex.StyleXStyles;
}

export type SpinnerProps =
  | (SpinnerBaseProps & {
      decorative: true;
      label?: never;
      showLabel?: never;
    })
  | (SpinnerBaseProps & {
      decorative?: false;
      label?: string;
      showLabel?: boolean;
    });

/** 読み込み中状態を示すアクセシブルなスピナー部品。 */
export function Spinner({
  size = "md",
  label = "読み込み中…",
  showLabel = false,
  decorative = false,
  style,
}: SpinnerProps) {
  if (decorative) {
    return <span aria-hidden="true" {...stylex.props(s.circle, s[size], style)} />;
  }

  return (
    <span role="status" aria-live="polite" aria-busy="true" {...stylex.props(s.root, style)}>
      <span aria-hidden="true" {...stylex.props(s.circle, s[size])} />
      <span {...stylex.props(showLabel ? s.label : s.srOnly)}>{label}</span>
    </span>
  );
}
