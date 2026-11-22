import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { Textarea, type TextareaProps } from "./Textarea";

const meta = {
  title: "shared/ui/Textarea",
  component: Textarea,
  tags: ["autodocs"],
  args: {
    label: "メモ",
    placeholder: "補足事項や背景を入力してください。",
    description: "最大500文字まで入力できます。",
    variant: "outlined",
    rows: 3,
  },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Outlined: Story = {};

export const Filled: Story = {
  args: {
    variant: "filled",
    defaultValue: "既存の入力テキストです。",
  },
};

export const Invalid: Story = {
  args: {
    label: "詳細説明",
    required: true,
    defaultValue: "短い入力",
    errorMessage: "20文字以上で入力してください。",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    defaultValue: "編集できない内容です。",
  },
};

export const AutoResize: Story = {
  args: {
    label: "自動伸縮メモ",
    autoResize: true,
    placeholder: "行を増やすと自動で高さが伸びます。",
  },
};

function ControlledTextarea(args: TextareaProps) {
  const [value, setValue] = useState("初期メモ");
  return (
    <Textarea
      {...args}
      value={value}
      onValueChange={setValue}
      description={`現在の文字数: ${value.length}文字`}
    />
  );
}

export const Controlled: Story = {
  render: (args) => <ControlledTextarea {...args} />,
};
