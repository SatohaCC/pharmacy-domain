import { describe, expect, it } from "vitest";
import { formatBusinessDateInTokyo } from "./businessDate";

describe("formatBusinessDateInTokyo", () => {
  it("UTC の前日扱いになる時間帯でも Asia/Tokyo の業務日付を返す", () => {
    expect(formatBusinessDateInTokyo(new Date("2026-11-26T15:30:00Z"))).toBe("2026-11-27");
    expect(formatBusinessDateInTokyo(new Date("2026-11-26T14:59:59Z"))).toBe("2026-11-26");
  });
});
