import * as stylex from "@stylexjs/stylex";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Skeleton } from "./Skeleton";

const overrides = stylex.create({ width: (width: number) => ({ width }) });

describe("Skeleton", () => {
  it("aria-hidden を付与し、text 複数行・lines<=0 の正規化・数値サイズ・動的 StyleX オーバーライドを扱う", () => {
    const { container, rerender } = render(<Skeleton variant="text" lines={3} />);

    const stack = container.firstElementChild;
    expect(stack).toHaveAttribute("aria-hidden", "true");
    expect(stack?.children).toHaveLength(3);

    rerender(<Skeleton variant="text" lines={0} style={overrides.width(180)} />);
    const singleLine = container.firstElementChild;
    expect(singleLine).toHaveAttribute("aria-hidden", "true");
    expect(singleLine?.tagName).toBe("SPAN");
    expect(singleLine?.getAttribute("style")).toMatch(/--[\w-]+:\s*180px/);

    rerender(<Skeleton variant="circular" width={48} height="3rem" />);
    const circle = container.firstElementChild;
    expect(circle).toHaveAttribute("aria-hidden", "true");
    expect(circle?.getAttribute("style")).toContain("48px");
    expect(circle?.getAttribute("style")).toContain("3rem");
  });
});
