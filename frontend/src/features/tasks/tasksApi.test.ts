import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/lib/api/apiClient";
import { extractFieldErrorMessage, fetchTasks, parseTaskItem, parseTaskList } from "./tasksApi";
import { fetchInitialTasks } from "./tasksServer";

const rawTask = {
  id: "task-1",
  title: "仕様書を更新する",
  description: "",
  status: "open",
  priority: "high",
  created_at: "2026-11-21T09:00:00Z",
  updated_at: "2026-11-21T09:00:00Z",
};

describe("tasksApi パーサとエラー抽出", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("妥当なタスクおよびタスク一覧ペイロードを変換できる", () => {
    const parsedTask = parseTaskItem(rawTask);
    const parsedList = parseTaskList({ items: [rawTask], total: 1 });

    expect(parsedTask).toEqual(rawTask);
    expect(parsedList).toEqual({ items: [rawTask], total: 1 });
  });

  it.each([
    ["欠落したタイトル", { ...rawTask, title: undefined }],
    ["空白だけの ID", { ...rawTask, id: "  " }],
    ["文字列以外の説明", { ...rawTask, description: 1 }],
    ["不正なステータス", { ...rawTask, status: "unknown" }],
    ["不正な優先度", { ...rawTask, priority: "urgent" }],
  ])("%s を含む応答を INVALID_RESPONSE で拒否する", (_name, data) => {
    expect(() => parseTaskItem(data)).toThrowError(
      expect.objectContaining({
        name: "ApiError",
        code: "INVALID_RESPONSE",
      }),
    );
  });

  it("一覧内の不正なタスクをリクエスト ID 付きの INVALID_RESPONSE で拒否する", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        { items: [{ ...rawTask, priority: "urgent" }], total: 1 },
        {
          headers: { "X-Request-ID": "req-invalid-task" },
        },
      ),
    );

    await expect(fetchTasks()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
      status: 200,
      requestId: "req-invalid-task",
    });
  });

  it("Backend の 422 構造化エラーから対象フィールドのメッセージを抽出できる", () => {
    const error = new ApiError("入力内容に誤りがあります", {
      status: 422,
      code: "HTTP_ERROR",
      errorCode: "VALIDATION_ERROR",
      errors: [
        {
          loc: ["body", "title"],
          msg: "Value error, タイトルを入力してください",
          type: "value_error",
        },
      ],
    });

    expect(extractFieldErrorMessage(error, "title")).toBe("タイトルを入力してください");
    expect(extractFieldErrorMessage(error, "description")).toBeNull();
  });

  it("fetchTasks は all と空白検索を除外してクエリを構築する", async () => {
    const requestedUrls: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      requestedUrls.push(typeof input === "string" ? input : input.toString());
      return new Response(JSON.stringify({ items: [], total: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    await fetchTasks({ status: "all", priority: "all", q: "   " });
    await fetchTasks({ status: "done", priority: "high", q: "  SQLite 検索  " });

    expect(requestedUrls[0]).toBe("/api/tasks");
    expect(requestedUrls[1]).toBe(
      "/api/tasks?status=done&priority=high&q=SQLite+%E6%A4%9C%E7%B4%A2",
    );
  });

  it("fetchInitialTasks は成功時に一覧を返し、失敗時に undefined へフォールバックする", async () => {
    const sampleList = {
      items: [
        {
          id: "task-1",
          title: "SSR タスク",
          description: "",
          status: "open",
          priority: "medium",
          created_at: "2026-11-21T09:00:00Z",
          updated_at: "2026-11-21T09:00:00Z",
        },
      ],
      total: 1,
    };

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(sampleList), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "SERVICE_UNAVAILABLE", detail: "障害" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(Response.json({ items: [], total: "1" }));

    const okResult = await fetchInitialTasks({ "x-request-id": "req-123" });
    expect(okResult).toEqual(sampleList);
    const firstCallInit = fetchSpy.mock.calls[0]?.[1];
    expect(new Headers(firstCallInit?.headers).get("x-request-id")).toBe("req-123");

    const fallbackResult = await fetchInitialTasks();
    expect(fallbackResult).toBeUndefined();
    await expect(fetchInitialTasks()).resolves.toBeUndefined();
  });
});
