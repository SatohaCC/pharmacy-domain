import { render, screen } from "@testing-library/react";
import { createAgent } from "@ui-sdk/react/agent";
import { useState } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Button } from "./button/Button";
import { Checkbox } from "./checkbox/Checkbox";
import { Dialog, DialogCloseButton } from "./dialog/Dialog";
import { Menu } from "./menu/Menu";
import { RadioGroup } from "./radio-group/RadioGroup";
import { Select } from "./select/Select";
import { Switch } from "./switch/Switch";
import { Tabs } from "./tabs/Tabs";
import { TextField } from "./text-field/TextField";
import { Textarea } from "./textarea/Textarea";
import { Tooltip } from "./tooltip/Tooltip";

const agent = createAgent();

const categories = [
  { value: "general", label: "一般" },
  { value: "development", label: "開発" },
];

const modes = [
  { value: "realtime", label: "即時処理" },
  { value: "batch", label: "一括処理" },
];

function SharedSettingsForm({
  onSubmitted,
  onValuesChange,
  onMenuAction,
}: {
  onSubmitted: (payload: Record<string, FormDataEntryValue | null>) => void;
  onValuesChange: (values: {
    displayName: string;
    memo: string;
    notes: string;
    category: string | null;
    mode: string | null;
    agree: boolean | "indeterminate";
    autosave: boolean;
  }) => void;
  onMenuAction: (value: string) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [memo, setMemo] = useState("");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState<string | null>("general");
  const [mode, setMode] = useState<string | null>("realtime");
  const [agree, setAgree] = useState<boolean | "indeterminate">(false);
  const [autosave, setAutosave] = useState(false);

  const emitChange = (
    patch: Partial<{
      displayName: string;
      memo: string;
      notes: string;
      category: string | null;
      mode: string | null;
      agree: boolean | "indeterminate";
      autosave: boolean;
    }>,
  ) => {
    onValuesChange({
      displayName,
      memo,
      notes,
      category,
      mode,
      agree,
      autosave,
      ...patch,
    });
  };

  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          onSubmitted({
            displayName: data.get("displayName"),
            memo: data.get("memo"),
            notes: data.get("notes"),
            category: data.get("category"),
            mode: data.get("mode"),
            agree: data.get("agree"),
            autosave: data.get("autosave"),
          });
        }}
      >
        <TextField
          label="表示名"
          name="displayName"
          value={displayName}
          onValueChange={(next) => {
            setDisplayName(next);
            emitChange({ displayName: next });
          }}
        />
        <Textarea
          label="詳細メモ"
          name="memo"
          value={memo}
          onValueChange={(next) => {
            setMemo(next);
            emitChange({ memo: next });
          }}
        />
        <Textarea
          label="補足コメント"
          name="notes"
          value={notes}
          onValueChange={(next) => {
            setNotes(next);
            emitChange({ notes: next });
          }}
        />
        <Select
          label="カテゴリ"
          name="category"
          items={categories}
          value={category}
          onValueChange={(next) => {
            setCategory(next);
            emitChange({ category: next });
          }}
        />
        <RadioGroup
          label="処理モード"
          name="mode"
          items={modes}
          value={mode}
          onValueChange={(next) => {
            setMode(next);
            emitChange({ mode: next });
          }}
        />
        <Checkbox
          label="利用規約に同意する"
          name="agree"
          checked={agree}
          onCheckedChange={(next) => {
            setAgree(next);
            emitChange({ agree: next });
          }}
        />
        <Switch
          label="自動保存"
          name="autosave"
          checked={autosave}
          onCheckedChange={(next) => {
            setAutosave(next);
            emitChange({ autosave: next });
          }}
        />
        <Button type="submit" variant="filled">
          設定を保存
        </Button>
      </form>
      <Dialog
        title="確認ダイアログ"
        description="操作を確定しますか？"
        triggerLabel="詳細確認を開く"
        closeLabel="閉じる"
        actions={<DialogCloseButton variant="filled">完了</DialogCloseButton>}
      />
      <Tabs
        aria-label="表示セクション"
        items={[
          { value: "basic", label: "基本情報", content: "基本情報パネル" },
          { value: "advanced", label: "詳細設定", content: "詳細設定パネル" },
        ]}
      />
      <Menu
        triggerLabel="追加アクション"
        items={[
          { value: "export", label: "設定を書き出す" },
          { value: "reset", label: "初期値に戻す" },
        ]}
        onAction={onMenuAction}
      />
      <Tooltip content="入力形式のヒントを表示します" triggerAriaLabel="入力ヒントを表示" delay={0}>
        ?
      </Tooltip>
    </>
  );
}

describe("共有 UI のエージェント操作契約", () => {
  const getAnimations = Element.prototype.getAnimations;
  const scrollIntoView = Element.prototype.scrollIntoView;
  let popoverStyle: HTMLStyleElement | null = null;

  beforeAll(() => {
    // jsdomにないWeb Animations API・scrollIntoView・Popover表示スタイルを補う。
    Element.prototype.getAnimations = () => [];
    Element.prototype.scrollIntoView = () => {};
    popoverStyle = document.createElement("style");
    popoverStyle.textContent = "[popover][data-open] { display: block !important; }";
    document.head.append(popoverStyle);
  });

  afterAll(() => {
    Element.prototype.getAnimations = getAnimations;
    Element.prototype.scrollIntoView = scrollIntoView;
    popoverStyle?.remove();
  });

  it("エージェントがフォーム入力・選択・切り替え・送信・ダイアログ操作を名前から実行できる", async () => {
    const onSubmitted = vi.fn();
    const onValuesChange = vi.fn();
    const onMenuAction = vi.fn();

    render(
      <SharedSettingsForm
        onSubmitted={onSubmitted}
        onValuesChange={onValuesChange}
        onMenuAction={onMenuAction}
      />,
    );

    const components = agent
      .snapshot()
      .filter((entry) => !entry.offPage && entry.component !== "more");

    for (const entry of components) {
      expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy();
    }

    const labels = components.map((entry) => entry.label);
    for (const expectedLabel of [
      "表示名",
      "詳細メモ",
      "補足コメント",
      "カテゴリ",
      "処理モード",
      "利用規約に同意する",
      "自動保存",
      "設定を保存",
      "詳細確認を開く",
      "追加アクション",
      "入力ヒントを表示",
    ]) {
      expect(labels, `${expectedLabel} is missing from snapshot`).toContain(expectedLabel);
    }

    const result = await agent.act({
      steps: [
        { ref: "表示名", action: "setValue", args: ["山田 太郎"] },
        { ref: "詳細メモ", action: "setValue", args: ["確認事項あり"] },
        { ref: "補足コメント", action: "setValue", args: ["共有UI追加分"] },
        { ref: "カテゴリ", action: "setValue", args: ["開発"] },
        { ref: "処理モード", action: "setValue", args: ["一括処理"] },
        { ref: "利用規約に同意する", action: "setChecked", args: [true] },
        { ref: "自動保存", action: "setChecked", args: [true] },
        { ref: "設定を保存", action: "press" },
      ],
    });

    expect(result.ok, result.error?.message).toBe(true);
    expect(screen.getByRole("textbox", { name: "表示名" })).toHaveValue("山田 太郎");
    expect(screen.getByRole("textbox", { name: "詳細メモ" })).toHaveValue("確認事項あり");
    expect(screen.getByRole("textbox", { name: "補足コメント" })).toHaveValue("共有UI追加分");
    expect(screen.getByRole("combobox", { name: "カテゴリ" })).toHaveTextContent("開発");
    expect(screen.getByRole("radio", { name: "一括処理" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("checkbox", { name: "利用規約に同意する" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("switch", { name: "自動保存" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    expect(onValuesChange).toHaveBeenLastCalledWith({
      displayName: "山田 太郎",
      memo: "確認事項あり",
      notes: "共有UI追加分",
      category: "development",
      mode: "batch",
      agree: true,
      autosave: true,
    });
    expect(onSubmitted).toHaveBeenCalledWith({
      displayName: "山田 太郎",
      memo: "確認事項あり",
      notes: "共有UI追加分",
      category: "development",
      mode: "batch",
      agree: "on",
      autosave: "on",
    });

    const dialogResult = await agent.act({
      steps: [
        { ref: "詳細確認を開く", action: "press" },
        { ref: "確認ダイアログ", action: "press", args: ["完了"] },
        { ref: "表示セクション", action: "select", args: ["詳細設定"] },
        { ref: "追加アクション", action: "press", args: ["設定を書き出す"] },
      ],
    });
    expect(dialogResult.ok, dialogResult.error?.message).toBe(true);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("tabpanel", { name: "詳細設定" })).toBeVisible();
    expect(onMenuAction).toHaveBeenCalledWith("export", expect.anything());

    const tooltipOpenResult = await agent.act({
      steps: [{ ref: "入力ヒントを表示", action: "setOpen", args: [true] }],
    });
    expect(tooltipOpenResult.ok, tooltipOpenResult.error?.message).toBe(true);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toBeVisible();
    expect(tooltip).toHaveTextContent("入力形式のヒントを表示します");

    const tooltipCloseResult = await agent.act({
      steps: [{ ref: "入力ヒントを表示", action: "setOpen", args: [false] }],
    });
    expect(tooltipCloseResult.ok, tooltipCloseResult.error?.message).toBe(true);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
