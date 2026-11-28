import * as stylex from "@stylexjs/stylex";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Field, FieldDescription, FieldError, FieldLabel } from "@ui-sdk/react/field";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Checkbox } from "./Checkbox";

describe("Checkbox", () => {
  it("クリックとSpaceキーでチェック状態を切り替え、説明文と関連付ける", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();

    render(
      <Checkbox
        label="変更内容を保存する"
        description="後から変更内容を確認できます。"
        onCheckedChange={onCheckedChange}
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: "変更内容を保存する" });
    expect(checkbox).toHaveAttribute("aria-checked", "false");
    expect(checkbox).toHaveAccessibleDescription("後から変更内容を確認できます。");

    await user.click(checkbox);
    expect(checkbox).toHaveAttribute("aria-checked", "true");
    expect(onCheckedChange).toHaveBeenCalledWith(true, expect.anything());

    checkbox.focus();
    await user.keyboard(" ");
    expect(checkbox).toHaveAttribute("aria-checked", "false");
  });

  it("不確定状態とエラー状態・無効状態を正しく表現する", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Checkbox label="すべて選択" defaultChecked="indeterminate" />);

    const checkbox = screen.getByRole("checkbox", { name: "すべて選択" });
    expect(checkbox).toHaveAttribute("aria-checked", "mixed");

    await user.click(checkbox);
    expect(checkbox).toHaveAttribute("aria-checked", "true");

    rerender(<Checkbox label="同意" errorMessage="必須項目です。" disabled />);
    const disabledCheckbox = screen.getByRole("checkbox", { name: "同意" });
    expect(disabledCheckbox).toBeDisabled();
    expect(disabledCheckbox).toHaveAttribute("aria-invalid", "true");
  });
});

it("aria-label で名前を指定したチェックボックスに説明文とエラー文を関連付ける", () => {
  render(<Checkbox aria-label="Consent" description="Purpose" errorMessage="Required" />);
  const control = screen.getByRole("checkbox", { name: "Consent" });
  expect(control).toHaveAccessibleDescription("Purpose Required");
  expect(control).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByText("Required")).toBeVisible();
});

it("表示ラベルがない場合も検証状態の変化で選択・フォーカスと説明の関連付けを保持する", async () => {
  function renderRow(invalid: boolean, errorMessage?: string) {
    return (
      <>
        <span id="row-description">選択すると一覧に追加します。</span>
        <Checkbox
          aria-label="行を選択"
          aria-describedby="row-description"
          invalid={invalid}
          errorMessage={errorMessage}
        />
      </>
    );
  }

  const user = userEvent.setup();
  const { rerender } = render(renderRow(false));
  const checkbox = screen.getByRole("checkbox", { name: "行を選択" });
  checkbox.focus();
  await user.keyboard(" ");
  expect(checkbox).toHaveAttribute("aria-checked", "true");

  rerender(renderRow(true));
  expect(checkbox).toHaveFocus();
  expect(checkbox).toHaveAttribute("aria-invalid", "true");

  rerender(renderRow(true, "この行は選択できません。"));
  expect(checkbox).toHaveFocus();
  expect(checkbox).toHaveAttribute("aria-checked", "true");
  expect(checkbox).toHaveAccessibleDescription(
    "選択すると一覧に追加します。 この行は選択できません。",
  );
  expect(screen.getByText("この行は選択できません。")).toBeVisible();

  rerender(renderRow(false));
  expect(checkbox).toHaveFocus();
  expect(checkbox).not.toHaveAttribute("aria-invalid", "true");
  expect(checkbox).toHaveAccessibleDescription("選択すると一覧に追加します。");
  expect(screen.queryByText("この行は選択できません。")).not.toBeInTheDocument();
});

const overrides = stylex.create({ width: (width: number) => ({ width }) });

it("forwards the inline variables of a dynamic StyleX override", () => {
  const { rerender } = render(<Checkbox aria-label="Selection" style={overrides.width(271)} />);
  expect(
    screen.getByRole("checkbox", { name: "Selection", hidden: true }).getAttribute("style"),
  ).toMatch(/--[\w-]+:\s*271px/);

  rerender(<Checkbox label="Selection" style={overrides.width(312)} />);
  const cb = screen.getByRole("checkbox", { name: "Selection", hidden: true });
  expect(cb.getAttribute("style") ?? "").toBe("");
  expect(cb.closest('[data-slot="field"]')?.getAttribute("style")).toMatch(/--[\w-]+:\s*312px/);
});

function ControlledCheckboxCase({ description }: { description?: string }) {
  const [checked, setChecked] = useState<boolean | "indeterminate">("indeterminate");
  return (
    <Checkbox
      aria-label="制御チェック"
      checked={checked}
      onCheckedChange={setChecked}
      description={description}
    />
  );
}

it("非制御のCheckboxは補足文の追加・削除後も名前・選択値・フォーカスを保持する", async () => {
  const user = userEvent.setup();

  function renderCase(description?: string) {
    return (
      <>
        <span id="cb-ext-label">外部ラベル</span>
        <span id="cb-ext-desc">外部説明</span>
        <Checkbox
          aria-labelledby="cb-ext-label"
          aria-describedby="cb-ext-desc"
          description={description}
        />
      </>
    );
  }

  const { rerender } = render(renderCase());
  const cb = screen.getByRole("checkbox", { name: "外部ラベル" });
  cb.focus();
  await user.keyboard(" ");
  expect(cb).toHaveAttribute("aria-checked", "true");

  rerender(renderCase("追加された補足文"));

  expect(cb).toHaveAccessibleName("外部ラベル");
  expect(cb).toHaveAttribute("aria-checked", "true");
  expect(cb).toHaveFocus();
  expect(cb).toHaveAccessibleDescription(/外部説明/);
  expect(cb).toHaveAccessibleDescription(/追加された補足文/);

  rerender(renderCase(undefined));

  expect(cb).toHaveAccessibleName("外部ラベル");
  expect(cb).toHaveAttribute("aria-checked", "true");
  expect(cb).toHaveFocus();
  expect(cb).toHaveAccessibleDescription("外部説明");
});

it("制御されたCheckboxは補足文の更新後も不確定状態とフォーカスを保持する", () => {
  const { rerender } = render(<ControlledCheckboxCase />);
  const checkbox = screen.getByRole("checkbox", { name: "制御チェック" });
  checkbox.focus();

  rerender(<ControlledCheckboxCase description="制御中の説明" />);

  expect(checkbox).toHaveAttribute("aria-checked", "mixed");
  expect(checkbox).toHaveFocus();
  expect(checkbox).toHaveAccessibleDescription("制御中の説明");
});

it("invalid={false}では表示ラベルの有無にかかわらずerrorMessageを抑止する", () => {
  const { rerender } = render(
    <Checkbox aria-label="単体" invalid={false} errorMessage="出ないエラー" />,
  );
  expect(screen.queryByText("出ないエラー")).not.toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: "単体" })).not.toHaveAttribute(
    "aria-invalid",
    "true",
  );

  rerender(<Checkbox label="ラベル付き" invalid={false} errorMessage="出ないエラー" />);
  expect(screen.queryByText("出ないエラー")).not.toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: "ラベル付き" })).not.toHaveAttribute(
    "aria-invalid",
    "true",
  );
});

it("外部Field・表示ラベルクリック・必須フォーム送信が正しく動作する", async () => {
  const user = userEvent.setup();
  let submitted: FormDataEntryValue | null = "unset";

  render(
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submitted = new FormData(event.currentTarget).get("agree");
      }}
    >
      <Field>
        <FieldLabel>外部同意</FieldLabel>
        <FieldDescription>確認してチェックしてください。</FieldDescription>
        <Checkbox name="agree" required />
        <FieldError />
      </Field>
      <button type="submit">送信</button>
    </form>,
  );

  const cb = screen.getByRole("checkbox", { name: "外部同意" });
  expect(cb).toHaveAccessibleDescription("確認してチェックしてください。");

  await user.click(screen.getByRole("button", { name: "送信" }));
  expect(cb).toHaveAttribute("aria-invalid", "true");
  expect(submitted).toBe("unset");

  await user.click(screen.getByText("外部同意"));
  expect(cb).toHaveAttribute("aria-checked", "true");
  await user.click(screen.getByRole("button", { name: "送信" }));
  expect(submitted).toBe("on");

  await user.click(cb);
  expect(cb).toHaveAttribute("aria-checked", "false");
});
