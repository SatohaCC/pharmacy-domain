import * as stylex from "@stylexjs/stylex";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { TextField } from "../text-field/TextField";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogCloseButton,
  DialogCloseIconButton,
  DialogHeader,
  DialogHeaderText,
  DialogHeading,
  DialogPanel,
  DialogRoot,
  DialogSummary,
  DialogTriggerButton,
} from "./Dialog";

function FocusTargetDialog() {
  const finalRef = useRef<HTMLButtonElement | null>(null);
  return (
    <>
      <Dialog
        title="フォーカス制御"
        triggerLabel="開く"
        initialFocus="#target-input"
        finalFocus={() => finalRef.current}
        actions={<DialogCloseButton variant="filled">閉じる</DialogCloseButton>}
      >
        <TextField id="target-input" label="入力欄" />
      </Dialog>
      <button ref={finalRef} type="button">
        復帰先ボタン
      </button>
    </>
  );
}

describe("Dialog", () => {
  it("トリガーで開き、閉じる操作とEscapeで閉じてトリガーへフォーカスを戻す", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <Dialog
        title="編集内容の確認"
        description="この編集を終了します。"
        triggerLabel="セッション終了"
        closeLabel="閉じる"
        onOpenChange={onOpenChange}
        actions={
          <>
            <DialogCloseButton variant="text">キャンセル</DialogCloseButton>
            <DialogCloseButton variant="filled">終了する</DialogCloseButton>
          </>
        }
      >
        <p>保存後に一覧へ戻ります。</p>
      </Dialog>,
    );

    const trigger = screen.getByRole("button", { name: "セッション終了" });
    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "編集内容の確認" });
    expect(dialog).toBeVisible();
    expect(dialog).toHaveAccessibleDescription("この編集を終了します。");
    expect(screen.getByText("保存後に一覧へ戻ります。")).toBeVisible();
    expect(onOpenChange).toHaveBeenCalledWith(true, expect.anything());

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("アイコン閉じるボタンでも閉じることができる", async () => {
    const user = userEvent.setup();

    render(<Dialog title="詳細設定" triggerLabel="開く" closeLabel="ダイアログを閉じる" />);

    await user.click(screen.getByRole("button", { name: "開く" }));
    expect(screen.getByRole("dialog", { name: "詳細設定" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "ダイアログを閉じる" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("initialFocusとfinalFocusで指定した要素へフォーカスを移動する", async () => {
    const user = userEvent.setup();

    render(<FocusTargetDialog />);

    await user.click(screen.getByRole("button", { name: "開く" }));
    expect(screen.getByRole("textbox", { name: "入力欄" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "閉じる" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "復帰先ボタン" })).toHaveFocus();
  });

  it("Compound Component で組み立てたダイアログが開閉・アクセシブル名・数値 0 の子要素を描画する", async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <DialogRoot>
        <DialogTriggerButton variant="tonal">詳細を開く</DialogTriggerButton>
        <DialogPanel>
          <DialogHeader>
            <DialogHeaderText>
              <DialogHeading>構成済みダイアログ</DialogHeading>
              <DialogSummary>パーツを直接組み合わせています。</DialogSummary>
            </DialogHeaderText>
            <DialogCloseIconButton label="右上で閉じる" />
          </DialogHeader>
          <DialogBody>本文コンテンツ</DialogBody>
          <DialogActions>
            <DialogCloseButton variant="text">閉じる</DialogCloseButton>
          </DialogActions>
        </DialogPanel>
      </DialogRoot>,
    );

    await user.click(screen.getByRole("button", { name: "詳細を開く" }));
    const compoundDialog = screen.getByRole("dialog", { name: "構成済みダイアログ" });
    expect(compoundDialog).toBeVisible();
    expect(compoundDialog).toHaveAccessibleDescription("パーツを直接組み合わせています。");

    await user.click(screen.getByRole("button", { name: "右上で閉じる" }));
    expect(screen.queryByRole("dialog", { name: "構成済みダイアログ" })).not.toBeInTheDocument();

    rerender(
      <Dialog title="数値テスト" defaultOpen actions={0}>
        {0}
      </Dialog>,
    );
    const openDialog = screen.getByRole("dialog", { name: "数値テスト" });
    expect(openDialog).toHaveTextContent("0");
  });
});

const overrides = stylex.create({ width: (width: number) => ({ width }) });

it("forwards the inline variables of a dynamic StyleX override", () => {
  render(<Dialog title="Settings" defaultOpen style={overrides.width(271)} />);
  expect(screen.getByRole("dialog", { hidden: true }).getAttribute("style")).toMatch(
    /--[\w-]+:\s*271px/,
  );
});
