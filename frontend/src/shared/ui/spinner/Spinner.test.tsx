import * as stylex from "@stylexjs/stylex";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Spinner } from "./Spinner";

const overrides = stylex.create({ width: (width: number) => ({ width }) });

describe("Spinner", () => {
  it("既定で status ロールと aria-busy を持ち、ラベルを支援技術へ提供する", () => {
    const { rerender } = render(<Spinner />);

    const defaultStatus = screen.getByRole("status");
    expect(defaultStatus).toHaveAttribute("aria-busy", "true");
    expect(defaultStatus).toHaveTextContent("読み込み中…");

    rerender(<Spinner label="処理中…" />);
    const customStatus = screen.getByRole("status");
    expect(customStatus).toHaveAttribute("aria-busy", "true");
    expect(customStatus).toHaveTextContent("処理中…");
  });

  it("decorative 指定時は aria-hidden な装飾要素のみを描画する", () => {
    const { container } = render(<Spinner decorative size="lg" />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("通常モードと decorative モードの双方で動的 StyleX オーバーライドの CSS 変数を転送する", () => {
    const { container, rerender } = render(<Spinner showLabel style={overrides.width(120)} />);

    expect(screen.getByRole("status").getAttribute("style")).toMatch(/--[\w-]+:\s*120px/);

    rerender(<Spinner decorative style={overrides.width(44)} />);
    expect(container.firstElementChild?.getAttribute("style")).toMatch(/--[\w-]+:\s*44px/);
  });
});
