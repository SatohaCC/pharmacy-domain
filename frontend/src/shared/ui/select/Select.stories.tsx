import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { Select, type SelectOption, type SelectProps } from "./Select";

const categories: readonly SelectOption[] = [
  { value: "general", label: "一般" },
  { value: "development", label: "開発" },
  { value: "design", label: "デザイン" },
  { value: "archived", label: "アーカイブ（選択不可）", disabled: true },
];

const meta = {
  title: "shared/ui/Select",
  component: Select,
  tags: ["autodocs"],
  args: {
    label: "カテゴリ",
    placeholder: "カテゴリを選択してください",
    description: "項目をカテゴリで分類します。",
    items: categories,
    variant: "outlined",
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Outlined: Story = {};

export const Filled: Story = {
  args: {
    variant: "filled",
    defaultValue: "development",
  },
};

export const Invalid: Story = {
  args: {
    required: true,
    errorMessage: "カテゴリを選択してください。",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    defaultValue: "general",
  },
};

export const FilledInvalid: Story = {
  args: {
    variant: "filled",
    required: true,
    errorMessage: "カテゴリを選択してください。",
  },
};

export const FilledDisabled: Story = {
  args: {
    variant: "filled",
    disabled: true,
    defaultValue: "development",
  },
};

function ControlledSelect(args: SelectProps) {
  const [value, setValue] = useState<string | null>("general");
  return (
    <Select
      {...args}
      value={value}
      onValueChange={setValue}
      description={`選択中のコード: ${value ?? "未選択"}`}
    />
  );
}

export const Controlled: Story = {
  render: (args) => <ControlledSelect {...args} />,
};
