import * as stylex from "@stylexjs/stylex";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Field, FieldDescription, FieldError, FieldLabel } from "@ui-sdk/react/field";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { RadioGroup } from "./RadioGroup";

const items = [
  { value: "realtime", label: "リアルタイム", description: "逐次反映します。" },
  { value: "batch", label: "一括要約", description: "終了後に作成します。" },
  { value: "archive", label: "保存のみ", disabled: true },
];

describe("RadioGroup", () => {
  it("クリックと矢印キーで選択を切り替え、無効項目をスキップする", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <RadioGroup
        label="処理モード"
        description="記録方法を選びます。"
        items={items}
        defaultValue="realtime"
        onValueChange={onValueChange}
      />,
    );

    const group = screen.getByRole("radiogroup", { name: "処理モード" });
    expect(group).toHaveAccessibleDescription("記録方法を選びます。");

    const realtime = screen.getByRole("radio", { name: "リアルタイム" });
    const batch = screen.getByRole("radio", { name: "一括要約" });
    const archive = screen.getByRole("radio", { name: "保存のみ" });

    expect(realtime).toHaveAttribute("aria-checked", "true");
    expect(realtime).toHaveAccessibleDescription("逐次反映します。");
    expect(archive).toBeDisabled();

    await user.click(batch);
    expect(batch).toHaveAttribute("aria-checked", "true");
    expect(onValueChange).toHaveBeenCalledWith("batch", expect.anything());

    batch.focus();
    await user.keyboard("{ArrowDown}");
    expect(realtime).toHaveAttribute("aria-checked", "true");
  });

  it("エラー状態とグループ無効状態を正しく表現する", () => {
    const { rerender } = render(
      <RadioGroup label="モード" items={items} errorMessage="いずれかを選択してください。" />,
    );

    expect(screen.getByText("いずれかを選択してください。")).toBeVisible();
    expect(screen.getByRole("radio", { name: "リアルタイム" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );

    rerender(<RadioGroup label="モード" items={items} disabled defaultValue="realtime" />);
    expect(screen.getByRole("radio", { name: "リアルタイム" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "一括要約" })).toBeDisabled();
  });
});

it("preserves feedback with an accessible name supplied by aria-label", () => {
  render(
    <RadioGroup aria-label="Mode" description="Method" errorMessage="Choose one" items={items} />,
  );
  const control = screen.getByRole("radiogroup", { name: "Mode" });
  expect(control).toHaveAccessibleDescription(/Method/);
  expect(screen.getByText("Choose one")).toBeVisible();
});

function ControlledRadioGroupCase({ errorMessage }: { errorMessage?: string }) {
  const [val, setVal] = useState<string | null>("realtime");
  return (
    <RadioGroup
      aria-label="制御モード"
      items={items}
      value={val}
      onValueChange={setVal}
      errorMessage={errorMessage}
    />
  );
}

it("補足文やエラーの更新でも非制御・制御の値とフォーカスと外部説明を保持する", async () => {
  const user = userEvent.setup();

  function renderUncontrolled(props: { description?: string; errorMessage?: string }) {
    return (
      <>
        <span id="ext-label">外部モード</span>
        <span id="ext-desc">外部の補足説明</span>
        <RadioGroup
          aria-labelledby="ext-label"
          aria-describedby="ext-desc"
          items={items}
          defaultValue="realtime"
          {...props}
        />
      </>
    );
  }

  const { rerender } = render(renderUncontrolled({}));
  const group = screen.getByRole("radiogroup", { name: "外部モード" });
  expect(group).toHaveAccessibleDescription("外部の補足説明");

  await user.click(screen.getByText("一括要約"));
  const batch = screen.getByRole("radio", { name: "一括要約" });
  expect(batch).toHaveAttribute("aria-checked", "true");
  expect(batch).toHaveFocus();

  rerender(renderUncontrolled({ errorMessage: "再確認してください。" }));
  expect(batch).toHaveAttribute("aria-checked", "true");
  expect(batch).toHaveFocus();
  expect(group).toHaveAttribute("aria-invalid", "true");
  expect(group).toHaveAccessibleDescription("外部の補足説明 再確認してください。");

  rerender(renderUncontrolled({ description: "処理方法を選びます。" }));
  expect(batch).toHaveAttribute("aria-checked", "true");
  expect(batch).toHaveFocus();
  expect(group).toHaveAccessibleDescription("外部の補足説明 処理方法を選びます。");

  rerender(<ControlledRadioGroupCase />);
  await user.click(screen.getByRole("radio", { name: "一括要約" }));
  rerender(<ControlledRadioGroupCase errorMessage="制御エラー" />);
  expect(screen.getByRole("radio", { name: "一括要約" })).toHaveAttribute("aria-checked", "true");
  expect(screen.getByRole("radio", { name: "一括要約" })).toHaveFocus();
  expect(screen.getByText("制御エラー")).toBeVisible();
});

it("invalidの明示指定と省略時推論をラベル有無にかかわらず一貫して扱う", () => {
  const { rerender } = render(<RadioGroup aria-label="モード" items={items} invalid />);
  expect(screen.getByRole("radiogroup", { name: "モード" })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(screen.getByRole("radio", { name: "リアルタイム" })).toHaveAttribute(
    "aria-invalid",
    "true",
  );

  rerender(
    <RadioGroup
      aria-label="モード"
      items={items}
      invalid={false}
      errorMessage="表示されないエラー"
    />,
  );
  expect(screen.queryByText("表示されないエラー")).not.toBeInTheDocument();
  expect(screen.getByRole("radiogroup", { name: "モード" })).not.toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(screen.getByRole("radio", { name: "リアルタイム" })).not.toHaveAttribute(
    "aria-invalid",
    "true",
  );

  rerender(
    <RadioGroup label="モード" items={items} invalid={false} errorMessage="表示されないエラー" />,
  );
  expect(screen.queryByText("表示されないエラー")).not.toBeInTheDocument();
  expect(screen.getByRole("radiogroup", { name: "モード" })).not.toHaveAttribute(
    "aria-invalid",
    "true",
  );
});

it("外部Fieldへの組み込みとフォーム必須検証・送信値を維持する", async () => {
  const user = userEvent.setup();
  let submittedValue: FormDataEntryValue | null = null;

  render(
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submittedValue = new FormData(event.currentTarget).get("mode");
      }}
    >
      <Field>
        <FieldLabel>外部グループ</FieldLabel>
        <FieldDescription>外部からの説明です。</FieldDescription>
        <RadioGroup name="mode" required items={items} />
        <FieldError />
      </Field>
      <button type="submit">送信</button>
    </form>,
  );

  const group = screen.getByRole("radiogroup", { name: "外部グループ" });
  expect(group).toHaveAccessibleDescription("外部からの説明です。");

  await user.click(screen.getByRole("button", { name: "送信" }));
  expect(group).toHaveAttribute("aria-invalid", "true");
  expect(submittedValue).toBeNull();

  await user.click(screen.getByText("一括要約"));
  await user.click(screen.getByRole("button", { name: "送信" }));
  expect(group).not.toHaveAttribute("aria-invalid", "true");
  expect(submittedValue).toBe("batch");
});

const overrides = stylex.create({ width: (width: number) => ({ width }) });

it("単体ではradiogroupに、Field付きではFieldルートに動的スタイルを適用する", () => {
  const { rerender } = render(
    <RadioGroup aria-label="Mode" items={items} style={overrides.width(271)} />,
  );
  expect(screen.getByRole("radiogroup", { name: "Mode" }).getAttribute("style")).toMatch(
    /--[\w-]+:\s*271px/,
  );

  rerender(<RadioGroup label="Mode" items={items} style={overrides.width(312)} />);
  const group = screen.getByRole("radiogroup", { name: "Mode" });
  expect(group.getAttribute("style") ?? "").toBe("");
  expect(group.closest('[data-slot="field"]')?.getAttribute("style")).toMatch(/--[\w-]+:\s*312px/);
});
