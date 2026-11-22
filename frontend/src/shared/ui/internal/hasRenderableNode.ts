import type { ReactNode } from "react";

/** ReactNode が描画可能な内容を持つか（数値 0 を含め、null / undefined / boolean / 空文字・空配列を除外）を判定する。 */
export function hasRenderableNode(node: ReactNode): boolean {
  if (node === null || node === undefined || typeof node === "boolean") {
    return false;
  }
  if (typeof node === "string") {
    return node.length > 0;
  }
  if (Array.isArray(node)) {
    return node.some(hasRenderableNode);
  }
  return true;
}
