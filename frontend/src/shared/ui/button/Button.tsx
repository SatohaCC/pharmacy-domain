"use client";

import * as stylex from "@stylexjs/stylex";
import { Button as UiButton } from "@ui-sdk/react/button";
import type { ComponentProps } from "react";
import { type ButtonSize, type ButtonVariant, getButtonStyles } from "../internal/buttonStyles";

export type { ButtonSize, ButtonVariant };

export interface ButtonProps
  extends Omit<ComponentProps<typeof UiButton>, "className" | "style" | "render"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  style?: stylex.StyleXStyles;
}

/** Material Design 3 準拠のボタン。 */
export function Button({
  variant = "filled",
  size = "md",
  style,
  type = "button",
  disabled = false,
  ...props
}: ButtonProps) {
  return (
    <UiButton
      type={type}
      disabled={disabled}
      style={stylex.props(style).style}
      className={(state) =>
        stylex.props(getButtonStyles(variant, size, state.disabled && !state.pending), style)
          .className
      }
      {...props}
    />
  );
}
