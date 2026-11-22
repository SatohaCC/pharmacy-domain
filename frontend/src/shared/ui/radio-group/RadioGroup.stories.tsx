import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { RadioGroup, type RadioGroupProps, type RadioOption } from "./RadioGroup";

const modes: readonly RadioOption[] = [
  {
    value: "realtime",
    label: "即時処理",
    description: "データを受信するたびに画面に反映します。",
  },
  {
    value: "batch",
    label: "一括処理",
    description: "収集したデータをまとめて処理します。",
  },
  {
    value: "archive",
    label: "保存のみ（準備中）",
    description: "処理を実行せずデータのみ保存します。",
    disabled: true,
  },
];

const meta = {
  title: "shared/ui/RadioGroup",
  component: RadioGroup,
  tags: ["autodocs"],
  args: {
    label: "処理モード",
    description: "データの処理方法を選択してください。",
    items: modes,
    defaultValue: "realtime",
  },
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {};

export const Horizontal: Story = {
  args: {
    label: "処理品質",
    description: undefined,
    orientation: "horizontal",
    defaultValue: "standard",
    items: [
      { value: "standard", label: "標準" },
      { value: "high", label: "高精度" },
      { value: "low", label: "高速" },
    ],
  },
};

export const Invalid: Story = {
  args: {
    defaultValue: null,
    required: true,
    errorMessage: "記録方法のいずれかを選択してください。",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    defaultValue: "batch",
  },
};

export const WithoutLabel: Story = {
  args: {
    label: undefined,
    description: undefined,
    "aria-label": "処理モード選択",
    defaultValue: "realtime",
  },
};

function ControlledRadioGroup(args: RadioGroupProps) {
  const [value, setValue] = useState<string | null>("realtime");
  return (
    <RadioGroup
      {...args}
      value={value}
      onValueChange={setValue}
      description={`選択中のモード: ${value ?? "未選択"}`}
    />
  );
}

export const Controlled: Story = {
  render: (args) => <ControlledRadioGroup {...args} />,
};
