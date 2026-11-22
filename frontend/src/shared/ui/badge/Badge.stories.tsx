import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "./Badge";

const meta = {
  title: "shared/ui/Badge",
  component: Badge,
  tags: ["autodocs"],
  args: {
    children: "Checking...",
    tone: "neutral",
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Neutral: Story = {};

export const Success: Story = {
  args: {
    tone: "success",
    children: "ok (template-backend)",
  },
};

export const Danger: Story = {
  args: {
    tone: "danger",
    children: "Error: HTTP 500",
  },
};
