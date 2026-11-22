import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { TextField, type TextFieldProps } from "./TextField";

const meta = {
  title: "shared/ui/TextField",
  component: TextField,
  tags: ["autodocs"],
  args: {
    label: "表示名",
    placeholder: "例: 山田 花子",
    description: "画面に表示する名前を入力してください。",
    variant: "outlined",
  },
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Outlined: Story = {};

export const Filled: Story = {
  args: {
    variant: "filled",
  },
};

export const WithAffix: Story = {
  args: {
    label: "実行時間の上限",
    defaultValue: "15",
    inputMode: "numeric",
    trailing: "分",
    description: "1〜60の範囲で指定できます。",
  },
};

export const Invalid: Story = {
  args: {
    label: "連絡先メールアドレス",
    type: "email",
    defaultValue: "invalid-email",
    errorMessage: "正しい形式のメールアドレスを入力してください。",
    required: true,
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    defaultValue: "変更できない項目",
  },
};

export const FilledInvalid: Story = {
  args: {
    variant: "filled",
    label: "連絡先メールアドレス",
    type: "email",
    defaultValue: "invalid-email",
    errorMessage: "正しい形式のメールアドレスを入力してください。",
    required: true,
  },
};

export const FilledDisabled: Story = {
  args: {
    variant: "filled",
    disabled: true,
    defaultValue: "変更できない項目",
  },
};

function ControlledTextField(args: TextFieldProps) {
  const [value, setValue] = useState("初期入力");
  return (
    <TextField
      {...args}
      value={value}
      onValueChange={setValue}
      description={`現在の文字数: ${value.length}文字`}
    />
  );
}

export const Controlled: Story = {
  render: (args) => <ControlledTextField {...args} />,
};
