import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Menu, type MenuEntry } from "./Menu";

const defaultItems: readonly MenuEntry[] = [
  { value: "edit", label: "編集", shortcut: "mod+e" },
  { value: "duplicate", label: "複製" },
  { value: "archive", label: "アーカイブ（無効）", disabled: true },
  { type: "separator", id: "sep-danger" },
  { value: "delete", label: "削除", destructive: true },
];

const meta = {
  title: "shared/ui/Menu",
  component: Menu,
  tags: ["autodocs"],
  args: {
    triggerLabel: "操作メニュー",
    items: defaultItems,
  },
} satisfies Meta<typeof Menu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {};

export const DefaultOpen: Story = {
  args: {
    defaultOpen: true,
    triggerVariant: "filled",
  },
};

export const DisabledTrigger: Story = {
  args: {
    disabled: true,
  },
};
