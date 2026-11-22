import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Skeleton } from "./Skeleton";

const meta = {
  title: "shared/ui/Skeleton",
  component: Skeleton,
  tags: ["autodocs"],
  args: {
    variant: "text",
    lines: 1,
  },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TextLines: Story = {
  args: {
    variant: "text",
    lines: 3,
  },
};

export const Rectangular: Story = {
  args: {
    variant: "rectangular",
    height: 120,
  },
};

export const Circular: Story = {
  args: {
    variant: "circular",
    width: 48,
    height: 48,
  },
};
