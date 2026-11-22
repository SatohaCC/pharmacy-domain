import type { TaskFilterPriority, TaskFilterState, TaskFilterStatus } from "./tasksApi";

export const DEFAULT_TASK_FILTERS: TaskFilterState = {
  status: "all",
  priority: "all",
  q: "",
};

const MAX_QUERY_LENGTH = 120;

type SearchParamsInput =
  | Record<string, string | string[] | undefined>
  | Pick<URLSearchParams, "get">;

function readFirstSearchParam(params: SearchParamsInput, key: string): string | undefined {
  if ("get" in params && typeof params.get === "function") {
    return params.get(key) ?? undefined;
  }
  const record = params as Record<string, string | string[] | undefined>;
  const raw = record[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

function parseFilterStatus(value: string | undefined): TaskFilterStatus {
  if (value === "open" || value === "done") {
    return value;
  }
  return "all";
}

function parseFilterPriority(value: string | undefined): TaskFilterPriority {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }
  return "all";
}

/** URL の検索パラメータから安全なタスク絞り込み状態を復元する。 */
export function parseTaskFiltersFromSearchParams(params: SearchParamsInput): TaskFilterState {
  const status = parseFilterStatus(readFirstSearchParam(params, "status"));
  const priority = parseFilterPriority(readFirstSearchParam(params, "priority"));
  const q = (readFirstSearchParam(params, "q")?.trim() ?? "").slice(0, MAX_QUERY_LENGTH);

  return { status, priority, q };
}

/** 既定値を省略した URLSearchParams へタスク絞り込み状態を直列化する。 */
export function serializeTaskFiltersToSearchParams(filters: TaskFilterState): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.status !== "all") {
    params.set("status", filters.status);
  }
  if (filters.priority !== "all") {
    params.set("priority", filters.priority);
  }
  const trimmedQuery = filters.q.trim();
  if (trimmedQuery) {
    params.set("q", trimmedQuery);
  }
  return params;
}

/** 検索文字列の前後空白を正規化したうえで 2 つの絞り込み条件が一致するか判定する。 */
export function isSameTaskFilters(a: TaskFilterState, b: TaskFilterState): boolean {
  return a.status === b.status && a.priority === b.priority && a.q.trim() === b.q.trim();
}
