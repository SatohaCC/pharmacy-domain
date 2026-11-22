import * as stylex from "@stylexjs/stylex";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Field, FieldDescription, FieldError, FieldLabel } from "@ui-sdk/react/field";
import { describe, expect, it, vi } from "vitest";
import { Textarea } from "./Textarea";

const overrides = stylex.create({ width: (width: number) => ({ width }) });

describe("Textarea", () => {
  it("ラベル・説明文とテキストエリアを関連付け、入力変更を通知する", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <Textarea
        label="概要メモ"
        description="変更理由を入力してください。"
        placeholder="ここに入力"
        rows={4}
        onValueChange={onValueChange}
      />,
    );

    const textarea = screen.getByRole("textbox", { name: "概要メモ" });
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea).toHaveAttribute("rows", "4");
    expect(textarea).toHaveAccessibleDescription("変更理由を入力してください。");

    await user.type(textarea, "テスト");
    expect(textarea).toHaveValue("テスト");
    expect(onValueChange).toHaveBeenLastCalledWith("テスト", expect.anything());
  });

  it("submitShortcut 押下で onSubmit を呼び出し、invalid={false} で errorMessage を抑止する", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <Textarea
        label="コメント"
        description="Ctrl+Enter で送信"
        invalid={false}
        errorMessage="表示されないエラー"
        submitShortcut="enter"
        onSubmit={onSubmit}
      />,
    );

    const textarea = screen.getByRole("textbox", { name: "コメント" });
    expect(screen.queryByText("表示されないエラー")).not.toBeInTheDocument();
    expect(textarea).not.toHaveAttribute("aria-invalid", "true");
    expect(textarea).toHaveAccessibleDescription("Ctrl+Enter で送信");

    await user.type(textarea, "送信内容{Enter}");
    expect(onSubmit).toHaveBeenCalledWith("送信内容", expect.anything());
  });

  it("表示ラベルなしの aria-label 指定・動的 style 転送先・外部 Field 内包のすべてに対応する", () => {
    const { rerender } = render(
      <Textarea
        aria-label="単体メモ"
        aria-describedby="external-hint"
        invalid
        style={overrides.width(260)}
      />,
    );

    const standalone = screen.getByRole("textbox", { name: "単体メモ" });
    expect(standalone).toHaveAttribute("aria-invalid", "true");
    expect(standalone.getAttribute("aria-describedby")).toContain("external-hint");
    expect(standalone.closest('[data-slot="textarea-box"]')?.getAttribute("style")).toMatch(
      /--[\w-]+:\s*260px/,
    );

    rerender(
      <Textarea
        aria-label="単体エラーあり"
        aria-describedby="external-hint"
        errorMessage="入力が必要です。"
        style={overrides.width(300)}
      />,
    );
    const withError = screen.getByRole("textbox", { name: "単体エラーあり" });
    expect(withError).toHaveAttribute("aria-invalid", "true");
    expect(withError.getAttribute("aria-describedby")).toContain("external-hint");
    expect(withError.closest('[data-slot="textarea-box"]')?.getAttribute("style") ?? "").toBe("");
    expect(withError.closest('[data-slot="field"]')?.getAttribute("style")).toMatch(
      /--[\w-]+:\s*300px/,
    );

    rerender(
      <Field name="outerMemo" invalid>
        <FieldLabel>外部ラベル</FieldLabel>
        <Textarea style={overrides.width(280)} />
        <FieldDescription>外部説明</FieldDescription>
        <FieldError match>外部エラー</FieldError>
      </Field>,
    );

    const wrapped = screen.getByRole("textbox", { name: "外部ラベル" });
    expect(wrapped).toHaveAttribute("aria-invalid", "true");
    expect(wrapped).toHaveAccessibleDescription("外部説明 外部エラー");
    const wrappedBox = wrapped.closest('[data-slot="textarea-box"]');
    expect(wrappedBox).toHaveAttribute("data-invalid", "");
    expect(wrappedBox?.getAttribute("style")).toMatch(/--[\w-]+:\s*280px/);

    rerender(
      <Field name="outerMemo" disabled>
        <FieldLabel>外部ラベル</FieldLabel>
        <Textarea style={overrides.width(280)} />
        <FieldDescription>外部説明</FieldDescription>
      </Field>,
    );

    const disabledWrapped = screen.getByRole("textbox", { name: "外部ラベル" });
    expect(disabledWrapped).toBeDisabled();
    expect(disabledWrapped.closest('[data-slot="textarea-box"]')).toHaveAttribute(
      "data-disabled",
      "",
    );
  });

  it("name 指定時はフォーム送信の FormData に値が設定される", async () => {
    const user = userEvent.setup();
    let submitted: FormDataEntryValue | null = null;

    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitted = new FormData(event.currentTarget).get("memo");
        }}
      >
        <Textarea label="メモ" name="memo" />
        <button type="submit">送信</button>
      </form>,
    );

    await user.type(screen.getByRole("textbox", { name: "メモ" }), "保存データ");
    await user.click(screen.getByRole("button", { name: "送信" }));
    expect(submitted).toBe("保存データ");
  });

  it("表示ラベルなしでも検証状態の変化でフォーカス・入力値・説明参照を維持する", async () => {
    function renderRow(invalid: boolean, errorMessage?: string) {
      return (
        <>
          <span id="row-memo-hint">補足説明です。</span>
          <Textarea
            aria-label="行メモ"
            aria-describedby="row-memo-hint"
            invalid={invalid}
            errorMessage={errorMessage}
          />
        </>
      );
    }

    const user = userEvent.setup();
    const { rerender } = render(renderRow(false));
    const textarea = screen.getByRole("textbox", { name: "行メモ" });
    await user.click(textarea);
    await user.type(textarea, "入力済み");
    expect(textarea).toHaveFocus();

    rerender(renderRow(true));
    expect(textarea).toHaveFocus();
    expect(textarea).toHaveAttribute("aria-invalid", "true");

    rerender(renderRow(true, "修正が必要です。"));
    expect(textarea).toHaveFocus();
    expect(textarea).toHaveValue("入力済み");
    expect(textarea).toHaveAccessibleDescription("補足説明です。 修正が必要です。");

    rerender(renderRow(false));
    expect(textarea).toHaveFocus();
    expect(textarea).not.toHaveAttribute("aria-invalid", "true");
    expect(textarea).toHaveAccessibleDescription("補足説明です。");
    expect(screen.queryByText("修正が必要です。")).not.toBeInTheDocument();
  });

  it("disabled 指定および内部 Field のネイティブ制約検証エラーが外枠へ連動する", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Textarea label="無効メモ" disabled />);

    const disabledTextarea = screen.getByRole("textbox", { name: "無効メモ" });
    expect(disabledTextarea).toBeDisabled();
    expect(disabledTextarea.closest('[data-slot="textarea-box"]')).toHaveAttribute(
      "data-disabled",
      "",
    );

    rerender(
      <form>
        <Textarea label="必須メモ" required />
        <button type="submit">送信</button>
      </form>,
    );

    const requiredTextarea = screen.getByRole("textbox", { name: /必須メモ/ });
    await user.click(screen.getByRole("button", { name: "送信" }));

    expect(requiredTextarea).toHaveAttribute("aria-invalid", "true");
    expect(requiredTextarea.closest('[data-slot="textarea-box"]')).toHaveAttribute(
      "data-invalid",
      "",
    );
  });

  it("外部 Field 内で errorMessage を動的に追加・解除しても要素の同一性・フォーカス・入力値・FormData 送信を保持する", async () => {
    const user = userEvent.setup();
    let submitted: FormDataEntryValue | null = null;

    function renderOuterField(errorMessage?: string) {
      return (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submitted = new FormData(event.currentTarget).get("outerMemo");
          }}
        >
          <Field name="outerMemo">
            <FieldLabel>外部ラベル</FieldLabel>
            <Textarea errorMessage={errorMessage} />
            <FieldDescription>外部説明</FieldDescription>
          </Field>
          <button type="submit">送信</button>
        </form>
      );
    }

    const { rerender } = render(renderOuterField());
    const initialNode = screen.getByRole("textbox", { name: "外部ラベル" });
    await user.click(initialNode);
    await user.type(initialNode, "入力途中のテキスト");
    expect(initialNode).toHaveFocus();
    expect(document.querySelectorAll('[data-slot="field"]')).toHaveLength(1);

    rerender(renderOuterField("20文字以上で入力してください。"));
    const withErrorNode = screen.getByRole("textbox", { name: "外部ラベル" });
    expect(withErrorNode).toBe(initialNode);
    expect(initialNode).toHaveFocus();
    expect(initialNode).toHaveValue("入力途中のテキスト");
    expect(initialNode).toHaveAttribute("aria-invalid", "true");
    expect(initialNode).toHaveAccessibleDescription("外部説明 20文字以上で入力してください。");
    expect(initialNode.closest('[data-slot="textarea-box"]')).toHaveAttribute("data-invalid", "");
    expect(document.querySelectorAll('[data-slot="field"]')).toHaveLength(1);

    rerender(renderOuterField());
    const clearedNode = screen.getByRole("textbox", { name: "外部ラベル" });
    expect(clearedNode).toBe(initialNode);
    expect(initialNode).toHaveFocus();
    expect(initialNode).toHaveValue("入力途中のテキスト");
    expect(initialNode).not.toHaveAttribute("aria-invalid", "true");
    expect(initialNode).toHaveAccessibleDescription("外部説明");
    expect(initialNode.closest('[data-slot="textarea-box"]')).not.toHaveAttribute("data-invalid");

    await user.click(screen.getByRole("button", { name: "送信" }));
    expect(submitted).toBe("入力途中のテキスト");
  });

  it("submitShortcut='enter' は IME 変換中・keyCode 229・修飾付き Enter を送信せず既定動作も抑止しない", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onFormSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
    });

    const { rerender } = render(
      <Textarea label="チャット入力" submitShortcut="enter" onSubmit={onSubmit} />,
    );

    const textarea = screen.getByRole("textbox", { name: "チャット入力" });
    await user.type(textarea, "変換中");

    expect(fireEvent.keyDown(textarea, { key: "Enter", isComposing: true })).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();

    expect(fireEvent.keyDown(textarea, { key: "Enter", keyCode: 229 })).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();

    expect(fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true })).toBe(true);
    expect(fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true })).toBe(true);
    expect(fireEvent.keyDown(textarea, { key: "Enter", metaKey: true })).toBe(true);
    expect(fireEvent.keyDown(textarea, { key: "Enter", altKey: true })).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();

    expect(fireEvent.keyDown(textarea, { key: "Enter" })).toBe(false);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("変換中", expect.anything());

    rerender(
      <form onSubmit={onFormSubmit}>
        <Textarea label="フォーム入力" name="message" submitShortcut="enter" />
      </form>,
    );

    const formTextarea = screen.getByRole("textbox", { name: "フォーム入力" });
    expect(fireEvent.keyDown(formTextarea, { key: "Enter", isComposing: true })).toBe(true);
    expect(fireEvent.keyDown(formTextarea, { key: "Enter", keyCode: 229 })).toBe(true);
    expect(onFormSubmit).not.toHaveBeenCalled();

    expect(fireEvent.keyDown(formTextarea, { key: "Enter" })).toBe(false);
    expect(onFormSubmit).toHaveBeenCalledTimes(1);

    rerender(<Textarea label="チャット入力" submitShortcut="enter" disabled onSubmit={onSubmit} />);
    expect(
      fireEvent.keyDown(screen.getByRole("textbox", { name: "チャット入力" }), { key: "Enter" }),
    ).toBe(true);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
