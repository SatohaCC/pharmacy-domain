import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as stylex from "@stylexjs/stylex";
import { useEffect, useState } from "react";
import { Button } from "../button/Button";
import { createToaster, type ToastType, ToastViewport } from "./Toast";
import { toastStoryStyles as s } from "./Toast.stories.styles";

const meta = {
  title: "shared/ui/Toast",
  component: ToastViewport,
  tags: ["autodocs"],
} satisfies Meta<typeof ToastViewport>;

export default meta;
type Story = StoryObj<typeof meta>;

function InteractiveToastDemo() {
  const [toaster] = useState(() => createToaster());

  useEffect(() => () => toaster.dismiss(), [toaster]);

  return (
    <div {...stylex.props(s.controls)}>
      <Button
        variant="filled"
        onClick={() =>
          toaster("下書きを保存しました", {
            description: "一覧画面からいつでも再開できます。",
            action: { label: "元に戻す", onAction: () => {} },
          })
        }
      >
        通常通知を表示
      </Button>
      <Button
        variant="tonal"
        onClick={() =>
          toaster.success("更新が完了しました", {
            description: "最新の状態が反映されています。",
          })
        }
      >
        成功通知を表示
      </Button>
      <Button
        variant="outlined"
        onClick={() =>
          toaster.error("送信に失敗しました", {
            description: "接続状況を確認して再試行してください。",
          })
        }
      >
        エラー通知を表示
      </Button>
      <ToastViewport toaster={toaster} />
    </div>
  );
}

function StaticToneDemo({
  tone,
  title,
  description,
  withAction = false,
}: {
  tone: ToastType;
  title: string;
  description: string;
  withAction?: boolean;
}) {
  const [toaster] = useState(() => createToaster({ duration: Number.POSITIVE_INFINITY }));

  useEffect(() => {
    const id = toaster({
      id: `story-${tone}`,
      type: tone,
      title,
      description,
      duration: Number.POSITIVE_INFINITY,
      action: withAction ? { label: "再実行", onAction: () => {} } : undefined,
    });
    return () => {
      toaster.dismiss(id);
    };
  }, [toaster, tone, title, description, withAction]);

  return (
    <div {...stylex.props(s.stage)}>
      <span>トーストプレビュー（{tone}）</span>
      <ToastViewport toaster={toaster} />
    </div>
  );
}

export const Interactive: Story = {
  render: () => <InteractiveToastDemo />,
};

export const DefaultTone: Story = {
  render: () => (
    <StaticToneDemo
      tone="default"
      title="設定を下書き保存しました"
      description="準備ができたら公開してください。"
      withAction
    />
  ),
};

export const SuccessTone: Story = {
  render: () => (
    <StaticToneDemo
      tone="success"
      title="設定を保存しました"
      description="すべての変更が反映されています。"
    />
  ),
};

export const ErrorTone: Story = {
  render: () => (
    <StaticToneDemo
      tone="error"
      title="通信エラーが発生しました"
      description="サーバーへ接続できませんでした。"
    />
  ),
};
