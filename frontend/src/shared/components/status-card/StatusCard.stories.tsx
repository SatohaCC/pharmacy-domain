import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StatusCard } from "./StatusCard";

const meta = {
  title: "shared/components/StatusCard",
  component: StatusCard,
  tags: ["autodocs"],
  args: {
    label: "Backend API",
    badgeText: "ok (template-backend)",
    badgeTone: "success",
    actionLabel: "Refresh Status",
    isActionDisabled: false,
    onAction: () => {},
  },
} satisfies Meta<typeof StatusCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Healthy: Story = {};

export const Loading: Story = {
  args: {
    badgeText: "Checking...",
    badgeTone: "neutral",
    actionLabel: "Checking...",
    isActionDisabled: true,
  },
};

export const ErrorState: Story = {
  args: {
    badgeText: "Error: HTTP 503",
    badgeTone: "danger",
    actionLabel: "Refresh Status",
    isActionDisabled: false,
  },
};
