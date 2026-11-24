import type { ZodType } from "zod";
import { ApiError } from "./apiClient";

/** Zod の検証失敗を API クライアントの応答エラーに変換する。 */
export function parseZodResponse<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ApiError(result.error.issues[0]?.message ?? "API の応答形式が不正です。", {
      code: "INVALID_RESPONSE",
      cause: result.error,
    });
  }
  return result.data;
}
