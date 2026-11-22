"use client";

import * as stylex from "@stylexjs/stylex";
import {
  TooltipContent,
  type TooltipContentProps,
  TooltipShortcut,
  TooltipTrigger,
  Tooltip as UiTooltip,
  type TooltipProps as UiTooltipProps,
} from "@ui-sdk/react/tooltip";
import type { ComponentProps, ReactNode } from "react";
import { type ButtonSize, type ButtonVariant, getButtonStyles } from "../internal/buttonStyles";
import { tooltipStyles as s } from "./Tooltip.styles";

interface TooltipBaseProps {
  content: string;
  shortcut?: string;
  children: ReactNode;
  triggerAriaLabel?: string;
  side?: TooltipContentProps["side"];
  align?: TooltipContentProps["align"];
  sideOffset?: TooltipContentProps["sideOffset"];
  delay?: UiTooltipProps["delay"];
  closeDelay?: UiTooltipProps["closeDelay"];
  toggleable?: UiTooltipProps["toggleable"];
  closeOnPress?: UiTooltipProps["closeOnPress"];
  disabled?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: UiTooltipProps["onOpenChange"];
  style?: stylex.StyleXStyles;
}

export type TooltipProps =
  | (TooltipBaseProps & {
      triggerRender: NonNullable<ComponentProps<typeof TooltipTrigger>["render"]>;
      triggerVariant?: never;
      triggerSize?: never;
      triggerStyle?: never;
    })
  | (TooltipBaseProps & {
      triggerRender?: never;
      triggerVariant?: ButtonVariant;
      triggerSize?: ButtonSize;
      triggerStyle?: stylex.StyleXStyles;
    });

/** Material Design 3 準拠の補足ヒントツールチップ。 */
export function Tooltip({
  content,
  shortcut,
  children,
  triggerVariant = "outlined",
  triggerSize = "sm",
  triggerRender,
  triggerAriaLabel,
  side = "top",
  align = "center",
  sideOffset = 6,
  delay = 400,
  closeDelay = 0,
  toggleable = false,
  closeOnPress = true,
  disabled = false,
  open,
  defaultOpen,
  onOpenChange,
  triggerStyle,
  style,
}: TooltipProps) {
  return (
    <UiTooltip
      shortcut={shortcut}
      delay={delay}
      closeDelay={closeDelay}
      toggleable={toggleable}
      closeOnPress={closeOnPress}
      disabled={disabled}
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
    >
      <TooltipTrigger
        aria-label={triggerAriaLabel}
        render={triggerRender}
        {...(triggerRender
          ? {}
          : stylex.props(getButtonStyles(triggerVariant, triggerSize), triggerStyle))}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        {...stylex.props(s.content, style)}
      >
        <span>{content}</span>
        {shortcut ? <TooltipShortcut className={stylex.props(s.shortcut).className} /> : null}
      </TooltipContent>
    </UiTooltip>
  );
}
