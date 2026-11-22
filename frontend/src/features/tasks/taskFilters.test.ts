import { describe, expect, it } from "vitest";
import {
  DEFAULT_TASK_FILTERS,
  isSameTaskFilters,
  parseTaskFiltersFromSearchParams,
  serializeTaskFiltersToSearchParams,
} from "./taskFilters";

describe("taskFilters", () => {
  it("Record と URLSearchParams から妥当なフィルタを復元し、不正値は既定値へフォールバックする", () => {
    expect(
      parseTaskFiltersFromSearchParams({
        status: "done",
        priority: "high",
        q: "  SQLite 検索  ",
      }),
    ).toEqual({
      status: "done",
      priority: "high",
      q: "SQLite 検索",
    });

    expect(
      parseTaskFiltersFromSearchParams(
        new URLSearchParams("status=invalid&priority=urgent&q=%20%20%20"),
      ),
    ).toEqual(DEFAULT_TASK_FILTERS);

    expect(
      parseTaskFiltersFromSearchParams({
        status: ["open", "done"],
        priority: ["low"],
        q: ["  配列先頭  ", "無視"],
      }),
    ).toEqual({
      status: "open",
      priority: "low",
      q: "配列先頭",
    });

    expect(parseTaskFiltersFromSearchParams({ q: "a".repeat(150) }).q).toHaveLength(120);
  });

  it("既定値と空白のみの検索クエリを除外して URLSearchParams へ直列化する", () => {
    expect(serializeTaskFiltersToSearchParams(DEFAULT_TASK_FILTERS).toString()).toBe("");
    expect(
      serializeTaskFiltersToSearchParams({
        status: "all",
        priority: "medium",
        q: "  API  ",
      }).toString(),
    ).toBe("priority=medium&q=API");
  });

  it("検索文字列の前後空白を無視してフィルタ同値性を判定する", () => {
    expect(
      isSameTaskFilters(
        { status: "open", priority: "high", q: "  SQLite " },
        { status: "open", priority: "high", q: "SQLite" },
      ),
    ).toBe(true);
    expect(
      isSameTaskFilters(
        { status: "open", priority: "high", q: "SQLite" },
        { status: "done", priority: "high", q: "SQLite" },
      ),
    ).toBe(false);
  });
});
