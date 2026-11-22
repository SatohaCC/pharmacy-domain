import { describe, expect, it } from "vitest";
import { ApiError } from "./apiClient";
import {
  expectArray,
  expectBoolean,
  expectLiteral,
  expectNonEmptyString,
  expectNumber,
  expectOptional,
  expectRecord,
  expectString,
} from "./validators";

describe("API レスポンス検証ヘルパー", () => {
  it("期待される型の値をそのまま返す", () => {
    expect(expectRecord({ ok: true })).toEqual({ ok: true });
    expect(expectString("")).toBe("");
    expect(expectNonEmptyString("ok")).toBe("ok");
    expect(expectLiteral("ok", "ok")).toBe("ok");
    expect(expectNumber(42)).toBe(42);
    expect(expectBoolean(false)).toBe(false);
    expect(expectArray(["a", "b"], (item) => expectString(item))).toEqual(["a", "b"]);
    expect(expectOptional(undefined, (value) => expectString(value))).toBeUndefined();
    expect(expectOptional(null, (value) => expectString(value))).toBeUndefined();
    expect(expectOptional("x", (value) => expectString(value))).toBe("x");
  });

  it("不正な型の場合は INVALID_RESPONSE の ApiError を投げる", () => {
    expect(() => expectRecord([])).toThrow(ApiError);
    expect(() => expectNonEmptyString("   ", "空文字不可")).toThrow("空文字不可");
    expect(() => expectLiteral("ng", "ok", "一致しません")).toThrow("一致しません");
    expect(() => expectNumber(Number.NaN)).toThrow(ApiError);
    expect(() => expectBoolean("true")).toThrow(ApiError);
    expect(() => expectArray("not-array", (item) => item)).toThrow(ApiError);
  });
});
