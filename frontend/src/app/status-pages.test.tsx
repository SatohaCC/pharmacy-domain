import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AppErrorPage from "./error";
import { GlobalErrorContent } from "./global-error";
import Loading from "./loading";
import NotFound from "./not-found";

describe("App Router 標準ステータス画面", () => {
  it("AppErrorPage はエラー情報と digest を表示し、再試行で retry を呼ぶ", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    const error = Object.assign(new Error("boom"), { digest: "err-digest-001" });

    render(<AppErrorPage error={error} retry={retry} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "予期しないエラーが発生しました" }),
    ).toBeInTheDocument();
    expect(screen.getByText("識別子: err-digest-001")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "トップページへ戻る" })).toHaveAttribute("href", "/");

    await user.click(screen.getByRole("button", { name: "再試行" }));

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("GlobalErrorContent はルート障害用メッセージ・digest を表示し、再試行で retry を呼ぶ", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    const error = Object.assign(new Error("fatal"), { digest: "global-digest-002" });

    render(<GlobalErrorContent error={error} retry={retry} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "アプリケーションの読み込みに失敗しました" }),
    ).toBeInTheDocument();
    expect(screen.getByText("識別子: global-digest-002")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "トップページへ戻る" })).toHaveAttribute("href", "/");

    await user.click(screen.getByRole("button", { name: "再試行" }));

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("NotFound は 404 見出しとトップページへの導線を表示する", () => {
    render(<NotFound />);

    expect(screen.getByRole("heading", { name: "ページが見つかりません" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "トップページへ戻る" })).toHaveAttribute("href", "/");
  });

  it("Loading はアクセシブルな読み込み状態を表示する", () => {
    render(<Loading />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveTextContent("読み込み中…");
  });
});
