import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { hasRenderableNode } from "./hasRenderableNode";

describe("hasRenderableNode", () => {
  it("数値 0 やテキスト・要素は true を返し、空値や非描画配列は false を返す", () => {
    expect(hasRenderableNode(0)).toBe(true);
    expect(hasRenderableNode("テキスト")).toBe(true);
    expect(hasRenderableNode(createElement("span", null, "要素"))).toBe(true);
    expect(hasRenderableNode([false, 0])).toBe(true);

    expect(hasRenderableNode(null)).toBe(false);
    expect(hasRenderableNode(undefined)).toBe(false);
    expect(hasRenderableNode(false)).toBe(false);
    expect(hasRenderableNode(true)).toBe(false);
    expect(hasRenderableNode("")).toBe(false);
    expect(hasRenderableNode([])).toBe(false);
    expect(hasRenderableNode([false, null, undefined, ""])).toBe(false);
  });
});
