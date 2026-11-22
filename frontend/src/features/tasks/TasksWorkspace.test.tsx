import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { QueryProvider } from "@/shared/lib/query/QueryProvider";
import { TasksWorkspace } from "./TasksWorkspace";
import { DEFAULT_TASK_FILTERS } from "./taskFilters";
import type { TaskItem } from "./tasksApi";

let mockRouteSearchParams: URLSearchParams | null = null;

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockRouteSearchParams,
}));

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function makeTask(patch: Partial<TaskItem> = {}): TaskItem {
  return {
    id: "task-1",
    title: "既存タスク",
    description: "SQLite 確認用のタスク",
    status: "open",
    priority: "medium",
    created_at: "2026-11-21T09:00:00Z",
    updated_at: "2026-11-21T09:00:00Z",
    ...patch,
  };
}

describe("TasksWorkspace", () => {
  const getAnimations = Element.prototype.getAnimations;
  const scrollIntoView = Element.prototype.scrollIntoView;
  const originalResizeObserver = globalThis.ResizeObserver;
  let popoverStyle: HTMLStyleElement | null = null;

  beforeAll(() => {
    Element.prototype.getAnimations = () => [];
    Element.prototype.scrollIntoView = () => {};
    globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
    popoverStyle = document.createElement("style");
    popoverStyle.textContent = "[popover][data-open] { display: block !important; }";
    document.head.append(popoverStyle);
  });

  afterAll(() => {
    Element.prototype.getAnimations = getAnimations;
    Element.prototype.scrollIntoView = scrollIntoView;
    globalThis.ResizeObserver = originalResizeObserver;
    popoverStyle?.remove();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockRouteSearchParams = null;
    window.history.replaceState(null, "", "/");
  });

  it("空タイトル検証でフォーカスを戻し、新規作成後に一覧とトーストを更新できる", async () => {
    const user = userEvent.setup();
    let tasks: TaskItem[] = [makeTask()];

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url.startsWith("/api/tasks") && method === "GET") {
        return new Response(JSON.stringify({ items: tasks, total: tasks.length }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url === "/api/tasks" && method === "POST") {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          title: string;
          description: string;
          priority: "low" | "medium" | "high";
        };
        const created = makeTask({
          id: "task-2",
          title: body.title,
          description: body.description,
          priority: body.priority,
        });
        tasks = [created, ...tasks];
        return new Response(JSON.stringify(created), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ code: "NOT_FOUND", detail: "Not found" }), {
        status: 404,
      });
    });

    const { container } = render(
      <QueryProvider>
        <TasksWorkspace initialTasks={{ items: tasks, total: tasks.length }} />
      </QueryProvider>,
    );

    expect(screen.getByText("既存タスク")).toBeVisible();

    const titleInput = screen.getByRole("textbox", { name: /タイトル/ });
    await user.click(screen.getByRole("button", { name: "タスクを追加" }));
    expect(within(container).getByText("タイトルを入力してください")).toBeVisible();
    expect(titleInput).toHaveAttribute("aria-invalid", "true");
    expect(titleInput).toHaveFocus();

    await user.type(titleInput, "新しいタスク");
    expect(within(container).queryByText("タイトルを入力してください")).not.toBeInTheDocument();
    expect(titleInput).not.toHaveAttribute("aria-invalid", "true");

    await user.type(screen.getByRole("textbox", { name: "詳細メモ" }), "確認用メモ");
    await user.click(screen.getByRole("radio", { name: "高" }));
    await user.click(screen.getByRole("button", { name: "タスクを追加" }));

    await waitFor(() => {
      expect(screen.getByText("新しいタスク")).toBeVisible();
    });
    expect(screen.getByText("タスクを追加しました")).toBeVisible();
  });

  it("チェックボックス切り替え・行メニューからの編集・削除確認を行える", async () => {
    const user = userEvent.setup();
    let tasks: TaskItem[] = [makeTask()];

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url.startsWith("/api/tasks") && method === "GET") {
        return new Response(JSON.stringify({ items: tasks, total: tasks.length }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url === "/api/tasks/task-1" && method === "PATCH") {
        const body = JSON.parse(String(init?.body ?? "{}")) as Partial<TaskItem>;
        tasks = tasks.map((item) => (item.id === "task-1" ? { ...item, ...body } : item));
        return new Response(JSON.stringify(tasks[0]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url === "/api/tasks/task-1" && method === "DELETE") {
        tasks = [];
        return new Response(null, { status: 204 });
      }

      return new Response(null, { status: 404 });
    });

    render(
      <QueryProvider>
        <TasksWorkspace initialTasks={{ items: tasks, total: tasks.length }} />
      </QueryProvider>,
    );

    const toggleCheckbox = screen.getByRole("checkbox", { name: "「既存タスク」を完了にする" });
    await user.click(toggleCheckbox);

    await waitFor(() => {
      expect(
        screen.getByRole("checkbox", { name: "「既存タスク」を未完了に戻す" }),
      ).toHaveAttribute("aria-checked", "true");
    });

    await user.click(screen.getByRole("button", { name: "「既存タスク」の操作" }));
    await user.click(screen.getByRole("menuitem", { name: "編集" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeVisible();
    const editTitleInput = within(dialog).getByRole("textbox", { name: /タイトル/ });
    expect(editTitleInput).toHaveFocus();
    await user.clear(editTitleInput);
    await user.type(editTitleInput, "編集後タスク");
    await user.click(within(dialog).getByRole("button", { name: "変更を保存" }));

    await waitFor(() => {
      expect(screen.getByText("編集後タスク")).toBeVisible();
    });

    await user.click(screen.getByRole("button", { name: "「編集後タスク」の操作" }));
    await user.click(screen.getByRole("menuitem", { name: "削除" }));

    const deleteDialog = await screen.findByRole("dialog");
    expect(within(deleteDialog).getByRole("button", { name: "キャンセル" })).toHaveFocus();
    await user.click(within(deleteDialog).getByRole("button", { name: "削除する" }));

    await waitFor(() => {
      expect(screen.queryByText("編集後タスク")).not.toBeInTheDocument();
    });
    expect(screen.getByText("タスクはまだありません")).toBeVisible();
  });

  it("取得エラー表示後に再読み込みで復帰でき、検索条件の絞り込みパラメータを送る", async () => {
    const user = userEvent.setup();
    let shouldFail = true;
    const requestedUrls: string[] = [];

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      requestedUrls.push(url);
      if (shouldFail) {
        return new Response(JSON.stringify({ code: "SERVICE_UNAVAILABLE", detail: "一時障害" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ items: [makeTask()], total: 1 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    render(
      <QueryProvider>
        <TasksWorkspace />
      </QueryProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("タスク一覧を読み込めませんでした")).toBeVisible();
    });
    expect(screen.getByText("一時障害")).toBeVisible();

    shouldFail = false;
    await user.click(screen.getByRole("button", { name: "再読み込み" }));

    await waitFor(() => {
      expect(screen.getByText("既存タスク")).toBeVisible();
    });

    await user.type(screen.getByRole("searchbox", { name: "キーワード検索" }), "SQLite");
    await user.click(screen.getByRole("radio", { name: "完了" }));

    await waitFor(() => {
      expect(
        requestedUrls.some((url) => url.includes("status=done") && url.includes("q=SQLite")),
      ).toBe(true);
    });
    expect(window.location.search).toBe("?status=done&q=SQLite");
  });

  it("新規作成の 422 フィールドエラーと 500 エラーを表示し、入力値を保持する", async () => {
    const user = userEvent.setup();
    let mode: "422" | "500" = "422";

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url.startsWith("/api/tasks") && method === "GET") {
        return new Response(JSON.stringify({ items: [], total: 0 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url === "/api/tasks" && method === "POST") {
        if (mode === "422") {
          return new Response(
            JSON.stringify({
              code: "VALIDATION_ERROR",
              detail: "入力値エラー",
              errors: [
                {
                  loc: ["body", "title"],
                  msg: "Value error, タイトルが重複しています",
                  type: "value_error",
                },
              ],
            }),
            { status: 422, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({
            code: "INTERNAL_ERROR",
            detail: "保存先 DB が応答しません",
          }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response(null, { status: 404 });
    });

    const { container } = render(
      <QueryProvider>
        <TasksWorkspace initialTasks={{ items: [], total: 0 }} />
      </QueryProvider>,
    );

    const createForm = within(container).getByRole("form", { name: "タスクを作成" });
    const titleInput = within(createForm).getByRole("textbox", { name: /タイトル/ });
    await user.type(titleInput, "重複タイトル");
    await user.click(within(createForm).getByRole("button", { name: "タスクを追加" }));

    await waitFor(() => {
      expect(within(createForm).getByText("タイトルが重複しています")).toBeVisible();
    });
    expect(titleInput).toHaveAttribute("aria-invalid", "true");
    expect(titleInput).toHaveFocus();
    expect(titleInput).toHaveValue("重複タイトル");

    mode = "500";
    await user.click(within(createForm).getByRole("button", { name: "タスクを追加" }));

    await waitFor(() => {
      expect(within(createForm).getByText("作成できませんでした")).toBeVisible();
    });
    expect(within(createForm).getByText("保存先 DB が応答しません")).toBeVisible();
    expect(titleInput).toHaveValue("重複タイトル");
  });

  it("完了切替の失敗・編集でのメモ空クリア・キャンセル初期化・通信中クローズ抑止を検証する", async () => {
    const user = userEvent.setup();
    let tasks: TaskItem[] = [
      makeTask({ id: "task-1", title: "既存タスク", description: "初期メモ" }),
    ];
    let patchMode: "fail" | "422" | "defer-then-fail" | "ok" = "fail";
    const deferredPatch = createDeferred<Response>();
    const sentPatches: Array<Record<string, unknown>> = [];

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url.startsWith("/api/tasks") && method === "GET") {
        return new Response(JSON.stringify({ items: tasks, total: tasks.length }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url === "/api/tasks/task-1" && method === "PATCH") {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        sentPatches.push(body);

        if (patchMode === "fail") {
          return new Response(
            JSON.stringify({ code: "INTERNAL_ERROR", detail: "状態変更に失敗" }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        if (patchMode === "422") {
          return new Response(
            JSON.stringify({
              code: "VALIDATION_ERROR",
              detail: "入力値エラー",
              errors: [
                {
                  loc: ["body", "title"],
                  msg: "Value error, 編集タイトルが不正です",
                  type: "value_error",
                },
              ],
            }),
            {
              status: 422,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        if (patchMode === "defer-then-fail") {
          return await deferredPatch.promise;
        }

        tasks = tasks.map((item) =>
          item.id === "task-1" ? ({ ...item, ...body } as TaskItem) : item,
        );
        return new Response(JSON.stringify(tasks[0]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(null, { status: 404 });
    });

    const { container } = render(
      <QueryProvider>
        <TasksWorkspace initialTasks={{ items: tasks, total: tasks.length }} />
      </QueryProvider>,
    );

    await user.click(screen.getByRole("checkbox", { name: "「既存タスク」を完了にする" }));
    await waitFor(() => {
      expect(screen.getByText("状態の更新に失敗しました")).toBeVisible();
    });

    // キャンセル後に開き直すと前回の未保存編集内容が初期化されることを確認する。
    await user.click(screen.getByRole("button", { name: "「既存タスク」の操作" }));
    await user.click(screen.getByRole("menuitem", { name: "編集" }));
    const firstDialog = await screen.findByRole("dialog");
    const firstTitle = within(firstDialog).getByRole("textbox", { name: /タイトル/ });
    await user.clear(firstTitle);
    await user.type(firstTitle, "破棄される編集");
    await user.click(within(firstDialog).getByRole("button", { name: "キャンセル" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "「既存タスク」の操作" }));
    await user.click(screen.getByRole("menuitem", { name: "編集" }));
    const editDialog = await screen.findByRole("dialog");
    const editTitle = within(editDialog).getByRole("textbox", { name: /タイトル/ });
    expect(editTitle).toHaveValue("既存タスク");

    // 詳細メモを空文字へクリアし、422 フィールドエラーと 500 時のクローズ抑止を順に検証する。
    await user.clear(within(editDialog).getByRole("textbox", { name: "詳細メモ" }));
    patchMode = "422";
    await user.click(within(editDialog).getByRole("button", { name: "変更を保存" }));

    await waitFor(() => {
      expect(within(editDialog).getByText("編集タイトルが不正です")).toBeVisible();
    });
    expect(editTitle).toHaveAttribute("aria-invalid", "true");
    expect(editTitle).toHaveFocus();

    patchMode = "defer-then-fail";
    await user.click(within(editDialog).getByRole("button", { name: "変更を保存" }));

    await waitFor(() => {
      expect(within(editDialog).getByRole("button", { name: "保存中…" })).toBeDisabled();
    });
    expect(within(editDialog).getByRole("button", { name: "キャンセル" })).toBeDisabled();
    expect(within(editDialog).queryByRole("button", { name: "閉じる" })).not.toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    deferredPatch.resolve(
      new Response(JSON.stringify({ code: "INTERNAL_ERROR", detail: "更新エラー" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await waitFor(() => {
      expect(within(editDialog).getByText("更新できませんでした")).toBeVisible();
    });
    expect(within(editDialog).getByText("更新エラー")).toBeVisible();

    patchMode = "ok";
    await user.click(within(editDialog).getByRole("button", { name: "変更を保存" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(sentPatches.at(-1)).toMatchObject({
      title: "既存タスク",
      description: "",
      priority: "medium",
      status: "open",
    });
    expect(within(container).queryByText("初期メモ")).not.toBeInTheDocument();
  });

  it("削除ダイアログは実行中のクローズを防ぎ、失敗エラーが別タスクへ残留しない", async () => {
    const user = userEvent.setup();
    const tasks: TaskItem[] = [
      makeTask({ id: "task-1", title: "削除対象1" }),
      makeTask({ id: "task-2", title: "削除対象2" }),
    ];
    const deferredDelete = createDeferred<Response>();

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url.startsWith("/api/tasks") && method === "GET") {
        return new Response(JSON.stringify({ items: tasks, total: tasks.length }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url === "/api/tasks/task-1" && method === "DELETE") {
        return await deferredDelete.promise;
      }

      return new Response(null, { status: 404 });
    });

    render(
      <QueryProvider>
        <TasksWorkspace initialTasks={{ items: tasks, total: tasks.length }} />
      </QueryProvider>,
    );

    await user.click(screen.getByRole("button", { name: "「削除対象1」の操作" }));
    await user.click(screen.getByRole("menuitem", { name: "削除" }));

    const firstDeleteDialog = await screen.findByRole("dialog");
    await user.click(within(firstDeleteDialog).getByRole("button", { name: "削除する" }));

    await waitFor(() => {
      expect(within(firstDeleteDialog).getByRole("button", { name: "削除中…" })).toBeDisabled();
    });
    expect(within(firstDeleteDialog).getByRole("button", { name: "キャンセル" })).toBeDisabled();
    expect(
      within(firstDeleteDialog).queryByRole("button", { name: "閉じる" }),
    ).not.toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    deferredDelete.resolve(
      new Response(JSON.stringify({ code: "INTERNAL_ERROR", detail: "削除に失敗しました" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await waitFor(() => {
      expect(within(firstDeleteDialog).getByText("削除できませんでした")).toBeVisible();
    });
    expect(within(firstDeleteDialog).getByText("削除に失敗しました")).toBeVisible();

    await user.click(within(firstDeleteDialog).getByRole("button", { name: "キャンセル" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "「削除対象2」の操作" }));
    await user.click(screen.getByRole("menuitem", { name: "削除" }));

    const secondDeleteDialog = await screen.findByRole("dialog");
    expect(within(secondDeleteDialog).getByText(/「削除対象2」を削除します/)).toBeVisible();
    expect(within(secondDeleteDialog).queryByText("削除できませんでした")).not.toBeInTheDocument();
  });

  it.each([
    { filter: "状態", query: "status=done" },
    { filter: "優先度", query: "priority=high" },
  ])("$filter の絞り込み中は直前の一覧を保持し、取得後に差し替える", async ({ filter, query }) => {
    const user = userEvent.setup();
    const response = createDeferred<Response>();
    const previousTask = makeTask();
    const requestUrl = `/api/tasks?${query}`;
    const fetchTasks = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (input === requestUrl) return response.promise;
      return Response.json({ items: [previousTask], total: 1 });
    });
    const nextTask = makeTask({
      id: "task-2",
      title: "絞り込み後のタスク",
      status: "done",
      priority: "high",
    });

    render(
      <QueryProvider>
        <TasksWorkspace initialTasks={{ items: [previousTask], total: 1 }} />
      </QueryProvider>,
    );
    expect(screen.getByText(previousTask.title)).toBeVisible();

    if (filter === "状態") {
      await user.click(screen.getByRole("radio", { name: "完了" }));
    } else {
      await user.click(screen.getByRole("combobox", { name: "優先度" }));
      await user.click(screen.getByRole("option", { name: "高" }));
    }

    await waitFor(() => {
      expect(fetchTasks).toHaveBeenCalledWith(requestUrl, expect.anything());
    });
    expect(screen.getByText(previousTask.title)).toBeVisible();
    expect(screen.getByText("最新の状態を取得中…")).toBeInTheDocument();
    expect(screen.queryByText("タスクを読み込んでいます…")).not.toBeInTheDocument();

    response.resolve(Response.json({ items: [nextTask], total: 1 }));

    expect(await screen.findByText(nextTask.title)).toBeVisible();
    expect(screen.queryByText(previousTask.title)).not.toBeInTheDocument();
    expect(screen.queryByText("最新の状態を取得中…")).not.toBeInTheDocument();
  });

  it("検索入力をデバウンスして URL クエリを同期し、popstate で条件を復元できる", async () => {
    const user = userEvent.setup();
    const requestedUrls: string[] = [];

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      requestedUrls.push(url);
      return new Response(JSON.stringify({ items: [makeTask()], total: 1 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    window.history.replaceState(null, "", "/?utm_source=test");

    render(
      <QueryProvider>
        <TasksWorkspace initialTasks={{ items: [makeTask()], total: 1 }} />
      </QueryProvider>,
    );

    const searchInput = screen.getByRole("searchbox", { name: "キーワード検索" });
    await user.type(searchInput, "SQLite");

    await waitFor(() => {
      expect(requestedUrls).toContain("/api/tasks?q=SQLite");
    });
    // 連続タイピング中の途中文字列（q=S など）では API 送信されない。
    expect(requestedUrls.some((url) => url.includes("q=S&") || url.endsWith("q=S"))).toBe(false);
    expect(window.location.search).toBe("?utm_source=test&q=SQLite");

    window.history.replaceState(null, "", "/?priority=high");
    window.dispatchEvent(new PopStateEvent("popstate"));

    await waitFor(() => {
      expect(requestedUrls).toContain("/api/tasks?priority=high");
    });
    expect(searchInput).toHaveValue("");
  });

  it("編集ダイアログに未保存変更がある場合、Escape 押下で破棄確認を表示し、破棄選択で閉じられる", async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.startsWith("/api/tasks")) {
        return new Response(JSON.stringify({ items: [makeTask()], total: 1 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(null, { status: 404 });
    });

    render(
      <QueryProvider>
        <TasksWorkspace initialTasks={{ items: [makeTask()], total: 1 }} />
      </QueryProvider>,
    );

    await user.click(screen.getByRole("button", { name: "「既存タスク」の操作" }));
    await user.click(screen.getByRole("menuitem", { name: "編集" }));

    const editDialog = await screen.findByRole("dialog");
    const editTitle = within(editDialog).getByRole("textbox", { name: /タイトル/ });
    expect(editTitle).toHaveFocus();
    await user.type(editTitle, "（変更中）");

    const beforeUnloadEvent = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(beforeUnloadEvent);
    expect(beforeUnloadEvent.defaultPrevented).toBe(true);

    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(within(editDialog).getByText("未保存の変更があります")).toBeVisible();

    const editForm = editDialog.querySelector("form");
    const discardConfirmAlert = within(editDialog).getByRole("alert");
    expect(editForm).not.toBeNull();
    expect(
      Boolean(
        editForm &&
          editForm.compareDocumentPosition(discardConfirmAlert) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);

    const continueButton = within(editDialog).getByRole("button", { name: "編集を続ける" });
    expect(continueButton).toHaveFocus();
    const describedById = continueButton.getAttribute("aria-describedby");
    expect(describedById).toBeTruthy();
    expect(document.getElementById(describedById as string)).toHaveTextContent(
      "変更を破棄して閉じますか？",
    );

    await user.click(continueButton);
    expect(within(editDialog).queryByText("未保存の変更があります")).not.toBeInTheDocument();
    expect(editTitle).toHaveValue("既存タスク（変更中）");
    expect(editTitle).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(within(editDialog).getByText("未保存の変更があります")).toBeVisible();
    expect(within(editDialog).getByRole("button", { name: "編集を続ける" })).toHaveFocus();

    await user.click(within(editDialog).getByRole("button", { name: "変更を破棄して閉じる" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("同一ルート遷移相当で initialFilters や useSearchParams が変わるとフィルタを同期し、自前 replaceState では入力中文字を保持する", async () => {
    const user = userEvent.setup();
    const requestedUrls: string[] = [];

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      requestedUrls.push(url);
      return new Response(JSON.stringify({ items: [makeTask()], total: 1 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    // 1. Router 外（useSearchParams が null）でも initialFilters の変化に追従する。
    const { rerender } = render(
      <QueryProvider>
        <TasksWorkspace
          initialTasks={{ items: [makeTask()], total: 1 }}
          initialFilters={{ status: "done", priority: "all", q: "SQLite" }}
        />
      </QueryProvider>,
    );

    const searchInput = screen.getByRole("searchbox", { name: "キーワード検索" });
    expect(searchInput).toHaveValue("SQLite");
    expect(screen.getByRole("radio", { name: "完了" })).toHaveAttribute("aria-checked", "true");

    rerender(
      <QueryProvider>
        <TasksWorkspace
          initialTasks={{ items: [makeTask()], total: 1 }}
          initialFilters={DEFAULT_TASK_FILTERS}
        />
      </QueryProvider>,
    );

    expect(searchInput).toHaveValue("");
    expect(screen.getByRole("radio", { name: "すべて" })).toHaveAttribute("aria-checked", "true");
    await waitFor(() => {
      expect(requestedUrls).toContain("/api/tasks");
    });

    // 2. App Router 内（useSearchParams が非 null）での Link 遷移と自前 replaceState の区別を検証する。
    requestedUrls.length = 0;
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");
    mockRouteSearchParams = new URLSearchParams("q=SQLite");
    window.history.replaceState(null, "", "/?q=SQLite");

    rerender(
      <QueryProvider key="router-mode">
        <TasksWorkspace initialTasks={{ items: [makeTask()], total: 1 }} />
      </QueryProvider>,
    );

    const routerSearchInput = screen.getByRole("searchbox", { name: "キーワード検索" });
    expect(routerSearchInput).toHaveValue("SQLite");

    // 同一ルート遷移（/tasks?q=SQLite -> /tasks）を模擬する。
    mockRouteSearchParams = new URLSearchParams("");
    window.history.replaceState({ __NA: true }, "", "/");
    rerender(
      <QueryProvider key="router-mode">
        <TasksWorkspace initialTasks={{ items: [makeTask()], total: 1 }} />
      </QueryProvider>,
    );

    expect(routerSearchInput).toHaveValue("");
    await waitFor(() => {
      expect(requestedUrls).toContain("/api/tasks");
    });

    // ユーザーが検索入力し、replaceState(null, ...) の結果が useSearchParams に遅れて反映されても入力中文字を維持する。
    replaceStateSpy.mockClear();
    await user.type(routerSearchInput, "abc");
    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith(null, "", "/?q=abc");
    });

    await user.type(routerSearchInput, "def");
    mockRouteSearchParams = new URLSearchParams("q=abc");
    rerender(
      <QueryProvider key="router-mode">
        <TasksWorkspace initialTasks={{ items: [makeTask()], total: 1 }} />
      </QueryProvider>,
    );
    expect(routerSearchInput).toHaveValue("abcdef");
  });

  it("入力ヒント属性を設定し、初期ビューポート外のタスク項目だけに遅延描画スタイルを適用する", () => {
    const tasks = Array.from({ length: 8 }, (_, index) =>
      makeTask({
        id: `task-${index + 1}`,
        title: `タスク ${index + 1}`,
      }),
    );

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: tasks, total: tasks.length }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(
      <QueryProvider>
        <TasksWorkspace initialTasks={{ items: tasks, total: tasks.length }} />
      </QueryProvider>,
    );

    const searchInput = screen.getByRole("searchbox", { name: "キーワード検索" });
    expect(searchInput).toHaveAttribute("enterkeyhint", "search");
    expect(searchInput).toHaveAttribute("autocapitalize", "none");
    expect(searchInput).toHaveAttribute("autocorrect", "off");
    expect(searchInput).toHaveAttribute("spellcheck", "false");

    const createTitleInput = screen.getByRole("textbox", { name: /タイトル/ });
    expect(createTitleInput).toHaveAttribute("enterkeyhint", "next");

    const listItems = screen.getAllByRole("listitem");
    expect(listItems).toHaveLength(8);
    const eagerClassName = listItems[0]?.className ?? "";
    const deferredClassName = listItems[6]?.className ?? "";
    expect(eagerClassName).not.toBe("");
    expect(deferredClassName).not.toBe(eagerClassName);
    for (const item of listItems.slice(0, 6)) {
      expect(item.className).toBe(eagerClassName);
    }
    for (const item of listItems.slice(6)) {
      expect(item.className).toBe(deferredClassName);
    }
  });
});
