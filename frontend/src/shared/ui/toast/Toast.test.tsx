import * as stylex from "@stylexjs/stylex";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createToaster, ToastViewport } from "./Toast";

const overrides = stylex.create({ width: (width: number) => ({ width }) });

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("ToastViewport", () => {
  const originalResizeObserver = globalThis.ResizeObserver;

  beforeAll(() => {
    globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
  });

  afterAll(() => {
    globalThis.ResizeObserver = originalResizeObserver;
  });

  it("createToaster 経由でトーストを表示し、アクション実行と閉じる操作ができる", async () => {
    const user = userEvent.setup();
    const toaster = createToaster({ duration: Number.POSITIVE_INFINITY });
    const onAction = vi.fn();

    render(<ToastViewport toaster={toaster} />);

    act(() => {
      toaster.success("保存しました", {
        description: "変更内容を記録しました。",
        action: { label: "元に戻す", onAction },
      });
    });

    expect(screen.getByRole("region", { name: "通知" })).toBeVisible();
    expect(screen.getByText("保存しました")).toBeVisible();
    expect(screen.getByText("変更内容を記録しました。")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "元に戻す" }));
    expect(onAction).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.queryByText("保存しました")).not.toBeInTheDocument();
    });
  });

  it("閉じるボタンと Escape キーでトーストを閉じられる", async () => {
    const user = userEvent.setup();
    const toaster = createToaster({ duration: Number.POSITIVE_INFINITY });

    render(<ToastViewport toaster={toaster} closeLabel="閉じる" />);

    act(() => {
      toaster.error("エラー通知", { description: "詳細メッセージ" });
    });

    const closeButton = screen.getByRole("button", { name: "閉じる" });
    closeButton.focus();
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByText("エラー通知")).not.toBeInTheDocument();
    });

    act(() => {
      toaster.info("案内通知");
    });
    expect(screen.getByText("案内通知")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "閉じる" }));

    await waitFor(() => {
      expect(screen.queryByText("案内通知")).not.toBeInTheDocument();
    });
  });

  it("複数トースト表示時に toast-list へレイアウト用クラスを付与し、動的 StyleX オーバーライドを転送する", () => {
    const toaster = createToaster({ duration: Number.POSITIVE_INFINITY });

    const { rerender } = render(
      <ToastViewport toaster={toaster} side="bottom" style={overrides.width(360)} />,
    );

    act(() => {
      toaster("1件目");
      toaster.success("2件目");
    });

    const region = screen.getByRole("region", { name: "通知" });
    expect(region.getAttribute("style")).toMatch(/--[\w-]+:\s*360px/);

    const list = region.querySelector<HTMLOListElement>('ol[data-slot="toast-list"]');
    expect(list).not.toBeNull();
    expect(list?.getAttribute("class") ?? "").toMatch(/\S+/);
    expect(list?.children).toHaveLength(2);

    rerender(<ToastViewport toaster={toaster} side="top" style={overrides.width(360)} />);
    const topList = region.querySelector<HTMLOListElement>('ol[data-slot="toast-list"]');
    expect(topList?.getAttribute("class") ?? "").toMatch(/\S+/);
  });
});
