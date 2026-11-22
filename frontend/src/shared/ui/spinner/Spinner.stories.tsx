import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Spinner } from "./Spinner";

const meta = {
  title: "shared/ui/Spinner",
  component: Spinner,
  tags: ["autodocs"],
  args: {
    size: "md",
    label: "読み込み中…",
    showLabel: true,
  },
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Medium: Story = {};

export const Small: Story = {
  args: {
    size: "sm",
    showLabel: false,
    label: "処理中",
  },
};

export const Large: Story = {
  args: {
    size: "lg",
    showLabel: true,
    label: "データを取得しています…",
  },
};
