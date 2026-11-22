import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Tooltip } from "./Tooltip";

const meta = {
  title: "shared/ui/Tooltip",
  component: Tooltip,
  tags: ["autodocs"],
  args: {
    content: "変更内容を保存します",
    children: "保存",
    side: "bottom",
    delay: 0,
  },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {};

export const DefaultOpen: Story = {
  args: {
    defaultOpen: true,
    shortcut: "mod+s",
  },
};

export const ToggleableInfo: Story = {
  args: {
    toggleable: true,
    triggerAriaLabel: "補足情報を表示",
    children: "?",
    content: "保存しない変更はページを閉じると破棄されます。",
  },
};
