const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*-_=+";
const ALL_CHARSETS = `${UPPERCASE}${LOWERCASE}${DIGITS}${SYMBOLS}`;

function randomIndex(maxExclusive: number): number {
  const limit = Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive;
  const buffer = new Uint32Array(1);
  while (true) {
    globalThis.crypto.getRandomValues(buffer);
    const value = buffer[0];
    if (value !== undefined && value < limit) {
      return value % maxExclusive;
    }
  }
}

function pickRandomChar(charset: string): string {
  const char = charset[randomIndex(charset.length)];
  if (!char) {
    throw new Error("文字セットが空です。");
  }
  return char;
}

/**
 * ガイドライン第7.0版（13文字以上・3種類以上混在）を満たす安全な初期パスワードを生成する。
 */
export function generateSecurePassword(length = 16): string {
  const targetLength = Math.max(13, Math.min(128, length));
  const chars: string[] = [
    pickRandomChar(UPPERCASE),
    pickRandomChar(LOWERCASE),
    pickRandomChar(DIGITS),
    pickRandomChar(SYMBOLS),
  ];

  while (chars.length < targetLength) {
    chars.push(pickRandomChar(ALL_CHARSETS));
  }

  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    const current = chars[i];
    const swapTarget = chars[j];
    if (current !== undefined && swapTarget !== undefined) {
      chars[i] = swapTarget;
      chars[j] = current;
    }
  }

  return chars.join("");
}

export interface PasswordPolicyEvaluation {
  hasMinLength: boolean;
  hasMaxLength: boolean;
  hasNoControlOrEdgeSpaces: boolean;
  classCount: number;
  isValid: boolean;
}

function hasControlCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) {
      return true;
    }
  }
  return false;
}

/** 入力中のパスワードがガイドライン要件を満たすかを判定する。 */
export function evaluatePasswordPolicy(password: string): PasswordPolicyEvaluation {
  const hasMinLength = password.length >= 13;
  const hasMaxLength = password.length <= 128;
  const hasNoControlOrEdgeSpaces =
    password.length > 0 && password === password.trim() && !hasControlCharacter(password);

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSymbol = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(password);
  const classCount = [hasUpper, hasLower, hasDigit, hasSymbol].filter(Boolean).length;

  return {
    hasMinLength,
    hasMaxLength,
    hasNoControlOrEdgeSpaces,
    classCount,
    isValid: hasMinLength && hasMaxLength && hasNoControlOrEdgeSpaces && classCount >= 3,
  };
}
