"use client";

import { useAppMutation } from "@/shared/lib/query/useAppMutation";
import { useAppQuery } from "@/shared/lib/query/useAppQuery";
import { DEFAULT_TASK_FILTERS, isSameTaskFilters } from "./taskFilters";
import {
  createTask,
  deleteTask,
  fetchTasks,
  type TaskFilterState,
  type TaskItem,
  type TaskList,
  updateTask,
} from "./tasksApi";

export { DEFAULT_TASK_FILTERS };

const EMPTY_TASKS: readonly TaskItem[] = [];

/** タスク一覧取得と作成・更新・削除ミューテーションを統合するカスタムフック。 */
export function useTasks(
  filters: TaskFilterState,
  initialTasks?: TaskList,
  initialFilters: TaskFilterState = DEFAULT_TASK_FILTERS,
) {
  const normalizedQuery = filters.q.trim();
  const matchesInitialFilters = isSameTaskFilters(filters, initialFilters);

  const tasksQuery = useAppQuery({
    queryKey: ["tasks", filters.status, filters.priority, normalizedQuery],
    queryFn: ({ signal }) => fetchTasks(filters, signal),
    initialData: matchesInitialFilters ? initialTasks : undefined,
    retainPreviousData: true,
  });

  const createMutation = useAppMutation({
    mutationFn: createTask,
    invalidateKeys: [["tasks"]],
  });

  const updateMutation = useAppMutation({
    mutationFn: updateTask,
    invalidateKeys: [["tasks"]],
  });

  const deleteMutation = useAppMutation({
    mutationFn: deleteTask,
    invalidateKeys: [["tasks"]],
  });

  return {
    tasks: tasksQuery.data?.items ?? EMPTY_TASKS,
    total: tasksQuery.data?.total ?? 0,
    isLoading: tasksQuery.isLoading,
    isFetching: tasksQuery.isFetching,
    errorMessage: tasksQuery.errorMessage,
    refetch: tasksQuery.refetch,
    createTaskAsync: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateTaskAsync: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteTaskAsync: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
