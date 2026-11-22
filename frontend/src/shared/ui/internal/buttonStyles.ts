import { buttonStyles } from "../button/Button.styles";

export type ButtonVariant = "filled" | "tonal" | "outlined" | "text" | "elevated";
export type ButtonSize = "sm" | "md";

/** Material Design 3 ボタンの StyleX スタイル配列を返す（Button・Dialog 間で共有）。 */
export function getButtonStyles(
  variant: ButtonVariant = "filled",
  size: ButtonSize = "md",
  disabled = false,
) {
  return [
    buttonStyles.base,
    buttonStyles[variant],
    buttonStyles[size],
    disabled && buttonStyles.disabled,
    disabled &&
      (variant === "filled" || variant === "tonal" || variant === "elevated") &&
      buttonStyles.disabledContainer,
    disabled && variant === "outlined" && buttonStyles.disabledOutline,
  ];
}
