import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdomにないWeb Animations APIとスクロールAPIをテスト環境向けに補う。
Element.prototype.getAnimations = () => [];
Element.prototype.scrollIntoView = () => {};

afterEach(() => {
  cleanup();
});
