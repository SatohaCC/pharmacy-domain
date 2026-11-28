import * as stylex from "@stylexjs/stylex";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Field, FieldDescription, FieldError, FieldLabel } from "@ui-sdk/react/field";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Switch } from "./Switch";

describe("Switch", () => {
  it("クリックとラベル操作で状態を切り替え、aria-checkedを更新する", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();

    render(
      <Switch
        label="自動保存"
        description="変更内容を自動で保存します。"
        onCheckedChange={onCheckedChange}
      />,
    );

    const control = screen.getByRole("switch", { name: "自動保存" });
    expect(control).toHaveAttribute("aria-checked", "false");
    expect(control).toHaveAccessibleDescription("変更内容を自動で保存します。");

    await user.click(control);
    expect(control).toHaveAttribute("aria-checked", "true");
    expect(onCheckedChange).toHaveBeenCalledWith(true, expect.anything());

    await user.click(screen.getByText("自動保存"));
    expect(control).toHaveAttribute("aria-checked", "false");
  });

  it("キーボードのSpaceで切り替わり、disabled時は操作できない", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();

    const { rerender } = render(<Switch aria-label="通知設定" onCheckedChange={onCheckedChange} />);

    const control = screen.getByRole("switch", { name: "通知設定" });
    control.focus();
    await user.keyboard(" ");
    expect(control).toHaveAttribute("aria-checked", "true");

    rerender(
      <Switch aria-label="通知設定" disabled defaultChecked onCheckedChange={onCheckedChange} />,
    );
    expect(screen.getByRole("switch", { name: "通知設定" })).toBeDisabled();
  });
});

it("preserves feedback with an accessible name supplied by aria-label", () => {
  render(<Switch aria-label="Audio" description="Recording mode" />);
  const control = screen.getByRole("switch", { name: "Audio" });
  expect(control).toHaveAccessibleDescription(/Recording mode/);
});

const overrides = stylex.create({ width: (width: number) => ({ width }) });

it("forwards the inline variables of a dynamic StyleX override", () => {
  const { rerender } = render(<Switch aria-label="Autosave" style={overrides.width(271)} />);
  expect(
    screen.getByRole("switch", { name: "Autosave", hidden: true }).getAttribute("style"),
  ).toMatch(/--[\w-]+:\s*271px/);

  rerender(<Switch label="Autosave" style={overrides.width(312)} />);
  const sw = screen.getByRole("switch", { name: "Autosave", hidden: true });
  expect(sw.getAttribute("style") ?? "").toBe("");
  expect(sw.closest('[data-slot="field"]')?.getAttribute("style")).toMatch(/--[\w-]+:\s*312px/);
});

function ControlledSwitchCase({ description }: { description?: string }) {
  const [checked, setChecked] = useState(false);
  return (
    <Switch
      aria-label="制御スイッチ"
      checked={checked}
      onCheckedChange={setChecked}
      description={description}
    />
  );
}

describe("Switch 再マウント防止と外部Field連携", () => {
  it("descriptionの追加・削除でも非制御・制御の値とフォーカスと外部説明を保持する", async () => {
    const user = userEvent.setup();

    function renderCase(description?: string) {
      return (
        <>
          <span id="sw-ext-label">外部スイッチ</span>
          <span id="sw-ext-desc">外部の説明</span>
          <Switch
            aria-labelledby="sw-ext-label"
            aria-describedby="sw-ext-desc"
            description={description}
          />
        </>
      );
    }

    const { rerender } = render(renderCase());
    const sw = screen.getByRole("switch", { name: "外部スイッチ" });
    sw.focus();
    await user.keyboard(" ");
    expect(sw).toHaveAttribute("aria-checked", "true");

    rerender(renderCase("補足説明を追加"));
    expect(sw).toHaveAttribute("aria-checked", "true");
    expect(sw).toHaveFocus();
    expect(sw).toHaveAccessibleDescription(/外部の説明/);
    expect(sw).toHaveAccessibleDescription(/補足説明を追加/);

    rerender(renderCase(undefined));
    expect(sw).toHaveAttribute("aria-checked", "true");
    expect(sw).toHaveFocus();
    expect(sw).toHaveAccessibleDescription("外部の説明");

    rerender(<ControlledSwitchCase />);
    const controlled = screen.getByRole("switch", { name: "制御スイッチ" });
    controlled.focus();
    await user.keyboard(" ");
    rerender(<ControlledSwitchCase description="制御中の説明" />);
    expect(controlled).toHaveAttribute("aria-checked", "true");
    expect(controlled).toHaveFocus();
  });

  it("外部Fieldへの組み込みと必須フォーム送信が正しく動作する", async () => {
    const user = userEvent.setup();
    let submitted: FormDataEntryValue | null = "unset";

    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitted = new FormData(event.currentTarget).get("notify");
        }}
      >
        <Field>
          <FieldLabel>通知を有効化</FieldLabel>
          <FieldDescription>重要な更新を受け取ります。</FieldDescription>
          <Switch name="notify" required />
          <FieldError />
        </Field>
        <button type="submit">送信</button>
      </form>,
    );

    const sw = screen.getByRole("switch", { name: "通知を有効化" });
    expect(sw).toHaveAccessibleDescription("重要な更新を受け取ります。");

    await user.click(screen.getByRole("button", { name: "送信" }));
    expect(sw).toHaveAttribute("aria-invalid", "true");
    expect(submitted).toBe("unset");

    await user.click(sw);
    await user.click(screen.getByRole("button", { name: "送信" }));
    expect(submitted).toBe("on");
  });
});
