import * as stylex from "@stylexjs/stylex";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Menu, type MenuEntry } from "./Menu";

const overrides = stylex.create({ width: (width: number) => ({ width }) });

const items: readonly MenuEntry[] = [
  { value: "rename", label: "名前を変更", shortcut: "mod+r" },
  { value: "disabled", label: "無効な操作", disabled: true },
  { type: "separator", id: "sep" },
  { value: "delete", label: "削除", destructive: true },
];

describe("Menu", () => {
  const getAnimations = Element.prototype.getAnimations;
  const scrollIntoView = Element.prototype.scrollIntoView;
  let popoverStyle: HTMLStyleElement | null = null;

  beforeAll(() => {
    // jsdom にない Web Animations API・scrollIntoView・Popover 表示スタイルを補う。
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

  it("クリックで開き、矢印キー移動・無効項目の実行抑止・Enter 選択で onAction を呼ぶ", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();

    render(<Menu triggerLabel="操作" items={items} onAction={onAction} />);

    const trigger = screen.getByRole("button", { name: "操作" });
    await user.click(trigger);

    expect(screen.getByRole("menu")).toBeVisible();
    expect(screen.getByRole("separator")).toBeInTheDocument();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: /名前を変更/ })).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    const disabledItem = screen.getByRole("menuitem", { name: "無効な操作" });
    expect(disabledItem).toHaveFocus();
    expect(disabledItem).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Enter}");
    expect(onAction).not.toHaveBeenCalled();

    await user.keyboard("{ArrowDown}");
    const deleteItem = screen.getByRole("menuitem", { name: "削除" });
    expect(deleteItem).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onAction).toHaveBeenCalledWith("delete", expect.anything());
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("Escape でメニューを閉じてトリガーへフォーカスを戻す", async () => {
    const user = userEvent.setup();

    render(<Menu triggerLabel="詳細" items={items} />);

    const trigger = screen.getByRole("button", { name: "詳細" });
    await user.click(trigger);
    expect(screen.getByRole("menu")).toBeVisible();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("trigger disabled 時は開かない", async () => {
    const user = userEvent.setup();

    render(<Menu triggerLabel="無効操作" items={items} disabled />);

    const trigger = screen.getByRole("button", { name: "無効操作" });
    expect(trigger).toBeDisabled();

    await user.click(trigger);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("shortcut 属性・aria-keyshortcuts および動的 StyleX オーバーライドを適用する", () => {
    render(
      <Menu
        triggerLabel="メニュー"
        items={items}
        defaultOpen
        triggerStyle={overrides.width(220)}
        style={overrides.width(280)}
      />,
    );

    expect(screen.getByRole("button", { name: "メニュー" }).getAttribute("style")).toMatch(
      /--[\w-]+:\s*220px/,
    );
    const menu = screen.getByRole("menu");
    expect(menu.getAttribute("style")).toMatch(/--[\w-]+:\s*280px/);

    const renameItem = screen.getByRole("menuitem", { name: /名前を変更/ });
    expect(renameItem).toHaveAttribute("aria-keyshortcuts");
    expect(renameItem.querySelector('[data-slot="menu-shortcut"]')).not.toBeNull();
  });
});
