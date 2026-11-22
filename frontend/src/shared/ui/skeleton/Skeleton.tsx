import * as stylex from "@stylexjs/stylex";
import { skeletonStyles as s } from "./Skeleton.styles";

export type SkeletonVariant = "text" | "rectangular" | "circular";

export interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  lines?: number;
  style?: stylex.StyleXStyles;
}

function toCssLength(value: string | number | undefined): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === "number" ? `${value}px` : value;
}

/** コンテンツ読み込み中に表示するスケルトンプレースホルダ。 */
export function Skeleton({ variant = "text", width, height, lines = 1, style }: SkeletonProps) {
  const resolvedWidth = toCssLength(width);
  const resolvedHeight = toCssLength(height);
  const lineCount = Math.max(1, Math.floor(lines));

  if (variant === "text" && lineCount > 1) {
    const lineIndices = Array.from({ length: lineCount }, (_, index) => index);
    return (
      <div aria-hidden="true" {...stylex.props(s.stack, style)}>
        {lineIndices.map((index) => (
          <span
            key={`line-${index}`}
            {...stylex.props(
              s.base,
              s.text,
              index === lineCount - 1 && !resolvedWidth && s.lastLine,
              resolvedWidth ? s.withWidth(resolvedWidth) : null,
              resolvedHeight ? s.withHeight(resolvedHeight) : null,
            )}
          />
        ))}
      </div>
    );
  }

  return (
    <span
      aria-hidden="true"
      {...stylex.props(
        s.base,
        s[variant],
        resolvedWidth ? s.withWidth(resolvedWidth) : null,
        resolvedHeight ? s.withHeight(resolvedHeight) : null,
        style,
      )}
    />
  );
}
