import { ApiError } from "./apiClient";

/** 値がプレーンなオブジェクト（Record）かどうかを判定する。 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 値がオブジェクトであることを検証して返す。 */
export function expectRecord(
  value: unknown,
  message = "レスポンスがオブジェクトではありません。",
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new ApiError(message, { code: "INVALID_RESPONSE" });
  }
  return value;
}

/** 値が文字列であることを検証して返す。 */
export function expectString(value: unknown, message = "文字列フィールドが不正です。"): string {
  if (typeof value !== "string") {
    throw new ApiError(message, { code: "INVALID_RESPONSE" });
  }
  return value;
}

/** 値が空文字でない文字列であることを検証して返す。 */
export function expectNonEmptyString(
  value: unknown,
  message = "空でない文字列フィールドが必要です。",
): string {
  const str = expectString(value, message);
  if (!str.trim()) {
    throw new ApiError(message, { code: "INVALID_RESPONSE" });
  }
  return str;
}

/** 値が指定されたリテラル値と一致することを検証して返す。 */
export function expectLiteral<const T extends string | number | boolean>(
  value: unknown,
  expected: T,
  message = "期待されたリテラル値と一致しません。",
): T {
  if (value !== expected) {
    throw new ApiError(message, { code: "INVALID_RESPONSE" });
  }
  return expected;
}

/** 値が有限数であることを検証して返す。 */
export function expectNumber(value: unknown, message = "数値フィールドが不正です。"): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ApiError(message, { code: "INVALID_RESPONSE" });
  }
  return value;
}

/** 値が真偽値であることを検証して返す。 */
export function expectBoolean(value: unknown, message = "真偽値フィールドが不正です。"): boolean {
  if (typeof value !== "boolean") {
    throw new ApiError(message, { code: "INVALID_RESPONSE" });
  }
  return value;
}

/** 値が配列であることを検証し、各要素にパーサを適用して返す。 */
export function expectArray<T>(
  value: unknown,
  parseItem: (item: unknown, index: number) => T,
  message = "配列フィールドが不正です。",
): T[] {
  if (!Array.isArray(value)) {
    throw new ApiError(message, { code: "INVALID_RESPONSE" });
  }
  return value.map((item, index) => parseItem(item, index));
}

/** 値が未定義または null の場合は undefined を返し、存在すればパーサを適用する。 */
export function expectOptional<T>(
  value: unknown,
  parseValue: (present: unknown) => T,
): T | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return parseValue(value);
}
