import * as stylex from "@stylexjs/stylex";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Button } from "../button/Button";
import { Tooltip } from "./Tooltip";

const overrides = stylex.create({ width: (width: number) => ({ width }) });

describe("Tooltip", () => {
  it("フォーカスで開き、Escape で閉じてもトリガーにフォーカスを維持する", async () => {
    const user = userEvent.setup();

    render(
      <Tooltip content="保存を実行します" shortcut="mod+s" delay={0}>
        保存
      </Tooltip>,
    );

    const trigger = screen.getByRole("button", { name: "保存" });
    await user.tab();
    expect(trigger).toHaveFocus();

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toBeVisible();
    expect(tooltip).toHaveTextContent("保存を実行します");

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("tooltip", { hidden: true })).toHaveAttribute("hidden");
    expect(trigger).toHaveFocus();
  });

  it("toggleable 指定時はクリックで開閉でき、disabled 指定時は表示されない", async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <Tooltip content="設定のヒント" toggleable delay={0}>
        ヒント
      </Tooltip>,
    );

    const trigger = screen.getByRole("button", { name: "ヒント" });
    await user.click(trigger);
    expect(await screen.findByRole("tooltip")).toBeVisible();

    await user.click(trigger);
    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });

    rerender(
      <Tooltip content="無効ヒント" disabled delay={0}>
        ヒント
      </Tooltip>,
    );
    trigger.focus();
    expect(screen.getByRole("tooltip", { hidden: true })).toHaveAttribute("hidden");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("動的 StyleX オーバーライド転送と triggerRender 時の既存 Button スタイル保持を確認する", () => {
    const { rerender } = render(
      <Tooltip
        content="ヒント本文"
        defaultOpen
        triggerStyle={overrides.width(140)}
        style={overrides.width(240)}
      >
        ヒント
      </Tooltip>,
    );

    expect(screen.getByRole("button", { name: "ヒント" }).getAttribute("style")).toMatch(
      /--[\w-]+:\s*140px/,
    );
    expect(screen.getByRole("tooltip").getAttribute("style")).toMatch(/--[\w-]+:\s*240px/);

    const { unmount } = render(<Button variant="filled">比較ボタン</Button>);
    const expectedClassName = screen.getByRole("button", { name: "比較ボタン" }).className;
    unmount();

    rerender(
      <Tooltip
        content="保存を実行します"
        triggerRender={<Button variant="filled">保存操作</Button>}
      >
        保存操作
      </Tooltip>,
    );

    const renderedTrigger = screen.getByRole("button", { name: "保存操作" });
    expect(renderedTrigger.className).toBe(expectedClassName);
    expect(renderedTrigger.getAttribute("style") ?? "").toBe("");
  });
});
