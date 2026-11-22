import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { Button } from "../button/Button";
import { Alert } from "./Alert";

const meta = {
  title: "shared/ui/Alert",
  component: Alert,
  tags: ["autodocs"],
  args: {
    tone: "info",
    title: "設定の案内",
    children: "変更内容は保存ボタンを押した後に反映されます。",
  },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Info: Story = {};

export const Success: Story = {
  args: {
    tone: "success",
    title: "保存しました",
    children: "プロジェクト設定の更新が完了しました。",
  },
};

export const Warning: Story = {
  args: {
    tone: "warning",
    title: "接続が不安定です",
    children: "再試行するか、ネットワーク設定を確認してください。",
  },
};

export const ErrorTone: Story = {
  name: "Error",
  args: {
    tone: "error",
    title: "保存に失敗しました",
    children: "入力内容を確認し、時間をおいて再度お試しください。",
  },
};

function DismissibleAlert() {
  const [visible, setVisible] = useState(true);
  if (!visible) {
    return (
      <Button variant="outlined" onClick={() => setVisible(true)}>
        通知を再表示
      </Button>
    );
  }
  return (
    <Alert
      tone="info"
      title="アップデートがあります"
      onDismiss={() => setVisible(false)}
      action={
        <Button variant="text" size="sm" onClick={() => setVisible(false)}>
          詳細
        </Button>
      }
    >
      新しいテンプレート設定が利用可能です。
    </Alert>
  );
}

export const Dismissible: Story = {
  render: () => <DismissibleAlert />,
};
