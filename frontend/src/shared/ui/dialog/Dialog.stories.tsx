import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { Button } from "../button/Button";
import { TextField } from "../text-field/TextField";
import { Dialog, DialogCloseButton, type DialogProps } from "./Dialog";
import { dialogStoryStyles as s } from "./Dialog.stories.styles";

const meta = {
  title: "shared/ui/Dialog",
  component: Dialog,
  tags: ["autodocs"],
  args: {
    title: "編集を終了しますか？",
    description: "下書きは現在の内容で保存されます。",
    triggerLabel: "編集を終了",
    closeLabel: "閉じる",
    actions: (
      <>
        <DialogCloseButton variant="text">キャンセル</DialogCloseButton>
        <DialogCloseButton variant="filled" value="confirm">
          終了して保存
        </DialogCloseButton>
      </>
    ),
  },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {};

export const WithFormContent: Story = {
  args: {
    title: "セッション名の変更",
    description: "一覧に表示されるセッション名を設定します。",
    triggerLabel: "名前を変更",
    defaultOpen: true,
    children: (
      <TextField
        label="セッション名"
        defaultValue="プロジェクト計画 2026-11-18"
        description="後からいつでも変更できます。"
      />
    ),
    actions: (
      <>
        <DialogCloseButton variant="text">キャンセル</DialogCloseButton>
        <DialogCloseButton variant="filled">保存する</DialogCloseButton>
      </>
    ),
  },
};

const termsParagraphs = Array.from({ length: 12 }, (_, index) => ({
  id: `term-${index + 1}`,
  text: `第${index + 1}条: 作業内容は保存ボタンを押した時点で記録されます。共有する前に内容を確認してください。`,
}));

export const ScrollableBody: Story = {
  args: {
    title: "利用規約の確認",
    description: "以下の内容をご確認のうえ、操作を選択してください。",
    triggerLabel: "利用規約を開く",
    defaultOpen: true,
    children: (
      <div>
        {termsParagraphs.map((paragraph) => (
          <p key={paragraph.id}>{paragraph.text}</p>
        ))}
      </div>
    ),
  },
};

function ControlledDialog(args: DialogProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="tonal" onClick={() => setOpen(true)}>
        外部ボタンから開く
      </Button>
      <Dialog
        {...args}
        triggerLabel={undefined}
        open={open}
        onOpenChange={setOpen}
        actions={
          <>
            <DialogCloseButton variant="text">閉じる</DialogCloseButton>
            <Button variant="filled" onClick={() => setOpen(false)}>
              確定
            </Button>
          </>
        }
      />
    </>
  );
}

export const Controlled: Story = {
  render: (args) => <ControlledDialog {...args} />,
};

export const DynamicWidth: Story = {
  args: {
    defaultOpen: true,
    style: s.width(300),
  },
};
