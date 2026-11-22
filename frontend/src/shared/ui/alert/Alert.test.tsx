import * as stylex from "@stylexjs/stylex";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Alert } from "./Alert";

const overrides = stylex.create({ width: (width: number) => ({ width }) });

describe("Alert", () => {
  it("tone に応じた適切な role（status / alert）とタイトル・本文を描画する", () => {
    const { rerender } = render(
      <Alert tone="info" title="案内">
        情報を表示します。
      </Alert>,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("案内");
    expect(status).toHaveTextContent("情報を表示します。");

    rerender(
      <Alert tone="error" title="エラー">
        保存に失敗しました。
      </Alert>,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("エラー");
    expect(alert).toHaveTextContent("保存に失敗しました。");
  });

  it("閉じるボタン押下で onDismiss を呼び出し、action を描画できる", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();

    render(
      <Alert
        tone="warning"
        onDismiss={onDismiss}
        dismissLabel="通知を閉じる"
        action={<button type="button">再試行</button>}
      >
        一時的な遅延が発生しています。
      </Alert>,
    );

    expect(screen.getByRole("button", { name: "再試行" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "通知を閉じる" }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("StyleX オーバーライドの動的 CSS 変数をルート要素に転送し、数値 0 の action と空文字 title を正しく扱う", () => {
    const { rerender } = render(
      <Alert tone="success" style={overrides.width(320)}>
        完了しました
      </Alert>,
    );

    expect(screen.getByRole("status").getAttribute("style")).toMatch(/--[\w-]+:\s*320px/);

    rerender(
      <Alert tone="info" title="" action={0}>
        本文メッセージ
      </Alert>,
    );
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("本文メッセージ");
    expect(status).toHaveTextContent("0");
    // body 直下には message のみが存在し、空タイトル要素は出力されない。
    expect(status.children[1]?.children).toHaveLength(1);
  });
});
