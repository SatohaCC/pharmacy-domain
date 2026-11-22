import { ApiError, apiRequest } from "@/shared/lib/api/apiClient";
import type { components } from "@/shared/lib/api/schema";
import { parseZodResponse, z } from "@/shared/lib/api/zodResponse";

export type TaskItem = components["schemas"]["TaskResponse"];
export type TaskList = components["schemas"]["TaskListResponse"];
export type TaskCreateInput = components["schemas"]["TaskCreateRequest"];
export type TaskUpdateInput = components["schemas"]["TaskUpdateRequest"];
export type TaskStatus = TaskItem["status"];
export type TaskPriority = TaskItem["priority"];

export type TaskFilterStatus = "all" | TaskStatus;
export type TaskFilterPriority = "all" | TaskPriority;

export interface TaskFilterState {
  status: TaskFilterStatus;
  priority: TaskFilterPriority;
  q: string;
}

function nonBlankString(message: string) {
  return z.string(message).refine((value) => value.trim().length > 0, message);
}

const taskItemSchema = z.object(
  {
    id: nonBlankString("タスク ID が不正です。"),
    title: nonBlankString("タスクタイトルが不正です。"),
    description: z.string("タスク説明が不正です。"),
    status: z.enum(["open", "done"], "タスクのステータスが不正です。"),
    priority: z.enum(["low", "medium", "high"], "タスクの優先度が不正です。"),
    created_at: nonBlankString("作成日時が不正です。"),
    updated_at: nonBlankString("更新日時が不正です。"),
  },
  "タスクデータの形式が不正です。",
);

const taskListSchema = z.object(
  {
    items: z.array(taskItemSchema, "タスク一覧の配列が不正です。"),
    total: z.number("タスク件数が不正です。"),
  },
  "タスク一覧データの形式が不正です。",
);

/** TaskResponse ペイロードを検証・変換する。 */
export function parseTaskItem(data: unknown): TaskItem {
  return parseZodResponse(taskItemSchema, data);
}

/** TaskListResponse ペイロードを検証・変換する。 */
export function parseTaskList(data: unknown): TaskList {
  return parseZodResponse(taskListSchema, data);
}

/** 条件に一致するタスク一覧を取得する。 */
export function fetchTasks(
  filters?: Partial<TaskFilterState>,
  signal?: AbortSignal,
): Promise<TaskList> {
  const trimmedQuery = filters?.q?.trim();
  return apiRequest("/api/tasks", {
    method: "get",
    signal,
    query: {
      status: filters?.status && filters.status !== "all" ? filters.status : undefined,
      priority: filters?.priority && filters.priority !== "all" ? filters.priority : undefined,
      q: trimmedQuery ? trimmedQuery : undefined,
    },
    parse: parseTaskList,
  });
}

/** 新規タスクを作成する。 */
export function createTask(input: TaskCreateInput): Promise<TaskItem> {
  return apiRequest("/api/tasks", {
    method: "post",
    body: input,
    parse: parseTaskItem,
  });
}

/** 既存タスクを部分更新する。 */
export function updateTask({
  taskId,
  patch,
}: {
  taskId: string;
  patch: TaskUpdateInput;
}): Promise<TaskItem> {
  return apiRequest("/api/tasks/{task_id}", {
    method: "patch",
    params: { task_id: taskId },
    body: patch,
    parse: parseTaskItem,
  });
}

/** 指定 ID のタスクを削除する。 */
export function deleteTask(taskId: string): Promise<void> {
  return apiRequest("/api/tasks/{task_id}", {
    method: "delete",
    params: { task_id: taskId },
  });
}

/** ApiError の 422 構造化エラーから対象フィールド向けのエラー文言を取り出す。 */
export function extractFieldErrorMessage(error: unknown, fieldName: string): string | null {
  if (!(error instanceof ApiError) || !error.errors?.length) {
    return null;
  }
  const matched = error.errors.find((item) => item.loc.includes(fieldName));
  if (!matched) {
    return null;
  }
  return matched.msg.replace(/^Value error,\s*/, "");
}
