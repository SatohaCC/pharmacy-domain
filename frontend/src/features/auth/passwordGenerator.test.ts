import { describe, expect, it } from "vitest";
import { evaluatePasswordPolicy, generateSecurePassword } from "./passwordGenerator";

describe("passwordGenerator", () => {
  it("ガイドライン準拠（13文字以上・3種類以上混在）のパスワードを生成する", () => {
    const generated = generateSecurePassword(16);

    expect(generated).toHaveLength(16);
    const evaluation = evaluatePasswordPolicy(generated);
    expect(evaluation.isValid).toBe(true);
    expect(evaluation.classCount).toBeGreaterThanOrEqual(3);
  });

  it("ポリシー判定で文字数不足・前後空白・文字種不足を検出する", () => {
    expect(evaluatePasswordPolicy("Short1!").isValid).toBe(false);
    expect(evaluatePasswordPolicy(" Abcdefgh1234!").isValid).toBe(false);
    expect(evaluatePasswordPolicy("abcdefgh12345").isValid).toBe(false);
    expect(evaluatePasswordPolicy("Abcdefgh12345").isValid).toBe(true);
  });
});
