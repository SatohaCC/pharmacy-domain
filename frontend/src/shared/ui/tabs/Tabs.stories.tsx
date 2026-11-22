import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { Tabs, type TabsProps } from "./Tabs";

const meta = {
  title: "shared/ui/Tabs",
  component: Tabs,
  args: {
    "aria-label": "表示内容",
    items: [
      { value: "overview", label: "概要", content: "概要のコンテンツです。" },
      { value: "details", label: "詳細", content: "詳細のコンテンツです。" },
      { value: "history", label: "履歴", content: "履歴のコンテンツです。" },
    ],
  },
} satisfies Meta<typeof Tabs>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};
export const Secondary: Story = { args: { variant: "secondary" } };
export const Disabled: Story = {
  args: {
    items: [...meta.args.items.slice(0, 2), { ...meta.args.items[2], disabled: true }],
  },
};
export const ManualActivation: Story = { args: { activation: "manual" } };
export const Scrollable: Story = {
  args: {
    items: Array.from({ length: 8 }, (_, index) => ({
      value: `section-${index}`,
      label: `セクション ${index + 1}`,
      content: `セクション ${index + 1}の内容です。`,
    })),
  },
};
function ControlledTabs(args: TabsProps) {
  const [value, setValue] = useState<string | null>("overview");
  return <Tabs {...args} value={value} onValueChange={setValue} />;
}
export const Controlled: Story = { render: (args) => <ControlledTabs {...args} /> };
