import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";

// jsdomにないWeb Animations API・スクロールAPI・Popover表示スタイルをテスト環境向けに補う。
Element.prototype.getAnimations = () => [];
Element.prototype.scrollIntoView = () => {};

let popoverStyle: HTMLStyleElement | null = null;

beforeAll(() => {
  popoverStyle = document.createElement("style");
  popoverStyle.textContent = "[popover][data-open] { display: block !important; }";
  document.head.append(popoverStyle);
});

afterAll(() => {
  popoverStyle?.remove();
  popoverStyle = null;
});

afterEach(() => {
  cleanup();
});
