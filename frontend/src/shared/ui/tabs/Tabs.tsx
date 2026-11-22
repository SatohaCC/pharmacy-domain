"use client";

import * as stylex from "@stylexjs/stylex";
import { TabsList, TabsPanel, TabsTab, Tabs as UiTabs } from "@ui-sdk/react/tabs";
import type { ComponentProps, ReactNode } from "react";
import { tabsStyles as s } from "./Tabs.styles";

export interface TabItem {
  value: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: readonly TabItem[];
  "aria-label": string;
  variant?: "primary" | "secondary";
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: ComponentProps<typeof UiTabs>["onValueChange"];
  activation?: "automatic" | "manual";
  style?: stylex.StyleXStyles;
}

export function Tabs({
  items,
  "aria-label": label,
  variant = "primary",
  style,
  ...props
}: TabsProps) {
  return (
    <UiTabs {...props} {...stylex.props(s.root, style)}>
      <TabsList aria-label={label} {...stylex.props(s.list)}>
        {items.map((item) => (
          <TabsTab
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            className={({ selected, disabled }) =>
              stylex.props(
                s.tab,
                selected && (variant === "primary" ? s.primarySelected : s.secondarySelected),
                selected && variant === "secondary" && s.secondaryIndicator,
                disabled && s.disabled,
              ).className
            }
          >
            {({ selected }) => (
              <span
                {...stylex.props(s.label, selected && variant === "primary" && s.primaryIndicator)}
              >
                {item.label}
              </span>
            )}
          </TabsTab>
        ))}
      </TabsList>
      {items.map((item) => (
        <TabsPanel key={item.value} value={item.value} {...stylex.props(s.panel)}>
          {item.content}
        </TabsPanel>
      ))}
    </UiTabs>
  );
}
