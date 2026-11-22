import { serverApiRequest } from "@/shared/lib/api/serverApiClient";
import { parseTaskList, type TaskFilterState, type TaskList } from "./tasksApi";

/** SSR 時に Backend から初期タスク一覧を取得する。取得失敗時はクライアント側での再取得に委ねる。 */
export async function fetchInitialTasks(
  incomingHeaders?: HeadersInit,
  filters?: Partial<TaskFilterState>,
): Promise<TaskList | undefined> {
  try {
    const trimmedQuery = filters?.q?.trim();
    return await serverApiRequest("/api/tasks", {
      method: "get",
      incomingHeaders,
      query: {
        status: filters?.status && filters.status !== "all" ? filters.status : undefined,
        priority: filters?.priority && filters.priority !== "all" ? filters.priority : undefined,
        q: trimmedQuery ? trimmedQuery : undefined,
      },
      parse: parseTaskList,
    });
  } catch {
    return undefined;
  }
}
