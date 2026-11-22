"use client";

import * as stylex from "@stylexjs/stylex";
import {
  MenuContent,
  type MenuContentProps,
  MenuItem,
  type MenuItemProps,
  MenuSeparator,
  MenuTrigger,
  Menu as UiMenu,
  type MenuProps as UiMenuProps,
} from "@ui-sdk/react/menu";
import { type ButtonSize, type ButtonVariant, getButtonStyles } from "../internal/buttonStyles";
import { menuStyles as s } from "./Menu.styles";

export interface MenuActionItem {
  type?: "item";
  value: string;
  label: string;
  disabled?: boolean;
  destructive?: boolean;
  shortcut?: string;
  closeOnSelect?: boolean;
  onSelect?: MenuItemProps["onSelect"];
}

export interface MenuSeparatorItem {
  type: "separator";
  id?: string;
}

export type MenuEntry = MenuActionItem | MenuSeparatorItem;

export interface MenuProps {
  triggerLabel: string;
  triggerVariant?: ButtonVariant;
  triggerSize?: ButtonSize;
  disabled?: boolean;
  items: readonly MenuEntry[];
  onAction?: UiMenuProps["onAction"];
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: UiMenuProps["onOpenChange"];
  side?: MenuContentProps["side"];
  align?: MenuContentProps["align"];
  sideOffset?: MenuContentProps["sideOffset"];
  triggerAriaLabel?: string;
  contentAriaLabel?: string;
  triggerStyle?: stylex.StyleXStyles;
  style?: stylex.StyleXStyles;
}

/** Material Design 3 準拠のアクションメニュー。 */
export function Menu({
  triggerLabel,
  triggerVariant = "outlined",
  triggerSize = "md",
  disabled = false,
  items,
  onAction,
  open,
  defaultOpen,
  onOpenChange,
  side = "bottom",
  align = "start",
  sideOffset = 4,
  triggerAriaLabel,
  contentAriaLabel,
  triggerStyle,
  style,
}: MenuProps) {
  return (
    <UiMenu open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange} onAction={onAction}>
      <MenuTrigger
        disabled={disabled}
        aria-label={triggerAriaLabel}
        {...stylex.props(getButtonStyles(triggerVariant, triggerSize, disabled), triggerStyle)}
      >
        {triggerLabel}
      </MenuTrigger>
      <MenuContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        aria-label={contentAriaLabel}
        {...stylex.props(s.content, style)}
      >
        {items.map((entry, index) => {
          if (entry.type === "separator") {
            return (
              <MenuSeparator
                key={entry.id ?? `separator-${index}`}
                className={stylex.props(s.separator).className}
              />
            );
          }

          return (
            <MenuItem
              key={entry.value}
              value={entry.value}
              label={entry.label}
              disabled={entry.disabled}
              destructive={entry.destructive}
              shortcut={entry.shortcut}
              closeOnSelect={entry.closeOnSelect}
              onSelect={entry.onSelect}
              className={(state) =>
                stylex.props(
                  s.item,
                  state.highlighted && s.itemHighlighted,
                  entry.destructive && s.itemDestructive,
                  state.disabled && s.itemDisabled,
                ).className
              }
            >
              <span {...stylex.props(s.itemLabel)}>{entry.label}</span>
            </MenuItem>
          );
        })}
      </MenuContent>
    </UiMenu>
  );
}
