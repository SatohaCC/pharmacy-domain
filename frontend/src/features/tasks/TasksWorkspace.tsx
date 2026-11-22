"use client";

import * as stylex from "@stylexjs/stylex";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Badge } from "@/shared/ui/badge/Badge";
import { Button } from "@/shared/ui/button/Button";
import { RadioGroup } from "@/shared/ui/radio-group/RadioGroup";
import { Select } from "@/shared/ui/select/Select";
import { Spinner } from "@/shared/ui/spinner/Spinner";
import { TextField } from "@/shared/ui/text-field/TextField";
import { createToaster, ToastViewport } from "@/shared/ui/toast/Toast";
import { Tooltip } from "@/shared/ui/tooltip/Tooltip";
import { TaskCreateForm } from "./TaskCreateForm";
import { TaskList } from "./TaskList";
import { tasksWorkspaceStyles as s } from "./TasksWorkspace.styles";
import {
  DEFAULT_TASK_FILTERS,
  parseTaskFiltersFromSearchParams,
  serializeTaskFiltersToSearchParams,
} from "./taskFilters";
import type {
  TaskCreateInput,
  TaskFilterPriority,
  TaskFilterState,
  TaskFilterStatus,
  TaskItem,
  TaskList as TaskListData,
  TaskStatus,
  TaskUpdateInput,
} from "./tasksApi";
import { useTasks } from "./useTasks";

const TaskEditDialog = dynamic(() => import("./TaskEditDialog").then((mod) => mod.TaskEditDialog), {
  loading: () => null,
});

const TaskDeleteDialog = dynamic(
  () => import("./TaskDeleteDialog").then((mod) => mod.TaskDeleteDialog),
  { loading: () => null },
);

const SEARCH_DEBOUNCE_MS = 250;

const STATUS_FILTER_ITEMS = [
  { value: "all", label: "すべて" },
  { value: "open", label: "未完了" },
  { value: "done", label: "完了" },
] as const;

const PRIORITY_FILTER_ITEMS = [
  { value: "all", label: "すべての優先度" },
  { value: "high", label: "高" },
  { value: "medium", label: "中" },
  { value: "low", label: "低" },
] as const;

export interface TasksWorkspaceProps {
  initialTasks?: TaskListData;
  initialFilters?: TaskFilterState;
}

/** タスク一覧・絞り込み・作成・編集・削除を統括するワークスペースコンテナ。 */
export function TasksWorkspace({
  initialTasks,
  initialFilters = DEFAULT_TASK_FILTERS,
}: TasksWorkspaceProps) {
  const routeSearchParams = useSearchParams();
  const externalFilters = useMemo(
    () =>
      routeSearchParams ? parseTaskFiltersFromSearchParams(routeSearchParams) : initialFilters,
    [routeSearchParams, initialFilters],
  );
  const externalFilterKey = useMemo(
    () => serializeTaskFiltersToSearchParams(externalFilters).toString(),
    [externalFilters],
  );

  const [prevExternalFilterKey, setPrevExternalFilterKey] = useState(externalFilterKey);
  const [filters, setFilters] = useState<TaskFilterState>(() => externalFilters);
  const [debouncedQuery, setDebouncedQuery] = useState(() => externalFilters.q.trim());
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [deletingTask, setDeletingTask] = useState<TaskItem | null>(null);
  const [hasLoadedEditDialog, setHasLoadedEditDialog] = useState(false);
  const [hasLoadedDeleteDialog, setHasLoadedDeleteDialog] = useState(false);
  const [toaster] = useState(() => createToaster());

  // 同一ルートへの Link 遷移などで外部から URL/props の条件が変わった場合のみ状態を同期する。
  const currentQueryKey = serializeTaskFiltersToSearchParams({
    status: filters.status,
    priority: filters.priority,
    q: debouncedQuery,
  }).toString();
  if (externalFilterKey !== prevExternalFilterKey) {
    setPrevExternalFilterKey(externalFilterKey);
    if (externalFilterKey !== currentQueryKey) {
      setFilters(externalFilters);
      setDebouncedQuery(externalFilters.q.trim());
    }
  }

  useEffect(() => {
    const trimmed = filters.q.trim();
    if (trimmed === "") {
      setDebouncedQuery("");
      return;
    }
    if (trimmed === debouncedQuery) {
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedQuery(trimmed);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filters.q, debouncedQuery]);

  const queryFilters = useMemo<TaskFilterState>(
    () => ({
      status: filters.status,
      priority: filters.priority,
      q: debouncedQuery,
    }),
    [filters.status, filters.priority, debouncedQuery],
  );
  const deferredQueryFilters = useDeferredValue(queryFilters);

  // URL クエリパラメータへ確定済みの検索条件を同期し、戻る・進む操作にも追従する。
  useEffect(() => {
    const nextParams = serializeTaskFiltersToSearchParams(queryFilters);
    const currentParams = new URLSearchParams(window.location.search);
    const currentFilterParams = serializeTaskFiltersToSearchParams(
      parseTaskFiltersFromSearchParams(currentParams),
    );
    if (nextParams.toString() === currentFilterParams.toString()) {
      return;
    }
    const mergedParams = new URLSearchParams(currentParams);
    mergedParams.delete("status");
    mergedParams.delete("priority");
    mergedParams.delete("q");
    nextParams.forEach((value, key) => {
      mergedParams.set(key, value);
    });
    const nextSearch = mergedParams.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
    // Next.js がパッチした replaceState に __NA 状態を渡すと useSearchParams 同期がスキップされるため null を渡す。
    window.history.replaceState(null, "", nextUrl);
  }, [queryFilters]);

  useEffect(() => {
    const handlePopState = () => {
      const nextFilters = parseTaskFiltersFromSearchParams(
        new URLSearchParams(window.location.search),
      );
      setFilters(nextFilters);
      setDebouncedQuery(nextFilters.q);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const {
    tasks,
    total,
    isLoading,
    isFetching,
    errorMessage,
    refetch,
    createTaskAsync,
    isCreating,
    updateTaskAsync,
    isUpdating,
    deleteTaskAsync,
    isDeleting,
  } = useTasks(deferredQueryFilters, initialTasks, initialFilters);

  const hasActiveFilters =
    filters.status !== "all" || filters.priority !== "all" || filters.q.trim() !== "";

  const handleCreate = useCallback(
    async (input: TaskCreateInput) => {
      const created = await createTaskAsync(input);
      toaster.success("タスクを追加しました", {
        description: `「${created.title}」を保存しました。`,
      });
    },
    [createTaskAsync, toaster],
  );

  const handleToggleStatus = useCallback(
    async (task: TaskItem, nextStatus: TaskStatus) => {
      try {
        const updated = await updateTaskAsync({
          taskId: task.id,
          patch: { status: nextStatus },
        });
        toaster.success(nextStatus === "done" ? "完了にしました" : "未完了に戻しました", {
          description: `「${updated.title}」の状態を更新しました。`,
        });
      } catch (error) {
        toaster.error("状態の更新に失敗しました", {
          description: error instanceof Error ? error.message : "時間をおいて再試行してください。",
        });
      }
    },
    [toaster, updateTaskAsync],
  );

  const handleEdit = useCallback((task: TaskItem) => {
    setHasLoadedEditDialog(true);
    setEditingTask(task);
  }, []);

  const handleDelete = useCallback((task: TaskItem) => {
    setHasLoadedDeleteDialog(true);
    setDeletingTask(task);
  }, []);

  const handleCloseEdit = useCallback(() => {
    setEditingTask(null);
  }, []);

  const handleCloseDelete = useCallback(() => {
    setDeletingTask(null);
  }, []);

  const handleSaveEdit = useCallback(
    async (taskId: string, patch: TaskUpdateInput) => {
      const updated = await updateTaskAsync({ taskId, patch });
      setEditingTask(null);
      toaster.success("タスクを更新しました", {
        description: `「${updated.title}」を保存しました。`,
      });
    },
    [toaster, updateTaskAsync],
  );

  const handleConfirmDelete = useCallback(
    async (task: TaskItem) => {
      await deleteTaskAsync(task.id);
      setDeletingTask(null);
      toaster.success("タスクを削除しました", {
        description: `「${task.title}」を削除しました。`,
      });
    },
    [deleteTaskAsync, toaster],
  );

  const handleResetFilters = useCallback(() => {
    setFilters(DEFAULT_TASK_FILTERS);
    setDebouncedQuery("");
  }, []);

  return (
    <div {...stylex.props(s.layout)}>
      <TaskCreateForm isSubmitting={isCreating} onCreate={handleCreate} />

      <div {...stylex.props(s.listColumn)}>
        <search aria-label="タスク絞り込み" {...stylex.props(s.filterCard)}>
          <RadioGroup
            label="状態"
            name="filterStatus"
            orientation="horizontal"
            items={STATUS_FILTER_ITEMS}
            value={filters.status}
            onValueChange={(nextStatus) => {
              if (nextStatus === "all" || nextStatus === "open" || nextStatus === "done") {
                setFilters((prev) => ({ ...prev, status: nextStatus as TaskFilterStatus }));
              }
            }}
          />

          <div {...stylex.props(s.filterGrid)}>
            <Select
              label="優先度"
              name="filterPriority"
              items={PRIORITY_FILTER_ITEMS}
              value={filters.priority}
              onValueChange={(nextPriority) => {
                if (
                  nextPriority === "all" ||
                  nextPriority === "low" ||
                  nextPriority === "medium" ||
                  nextPriority === "high"
                ) {
                  setFilters((prev) => ({
                    ...prev,
                    priority: nextPriority as TaskFilterPriority,
                  }));
                }
              }}
            />
            <TextField
              label="キーワード検索"
              name="q"
              type="search"
              autoComplete="off"
              enterKeyHint="search"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={120}
              placeholder="例: SQLite…"
              value={filters.q}
              onValueChange={(nextQuery) => setFilters((prev) => ({ ...prev, q: nextQuery }))}
            />
          </div>

          <div {...stylex.props(s.summaryBar)}>
            <div {...stylex.props(s.summaryLeft)}>
              <h2 {...stylex.props(s.summaryTitle)}>タスク一覧</h2>
              <Badge tone="neutral" style={s.countBadge}>
                {total} 件
              </Badge>
              <Tooltip
                toggleable
                triggerAriaLabel="永続化方式の説明"
                content="タスクは FastAPI 経由で SQLite に保存されます"
              >
                ?
              </Tooltip>
              {isFetching && !isLoading ? <Spinner size="sm" label="最新の状態を取得中…" /> : null}
            </div>
            <div {...stylex.props(s.summaryActions)}>
              <Button
                type="button"
                variant="outlined"
                size="sm"
                disabled={!hasActiveFilters}
                onClick={handleResetFilters}
              >
                条件をリセット
              </Button>
              <Button
                type="button"
                variant="tonal"
                size="sm"
                disabled={isFetching}
                onClick={refetch}
              >
                最新の状態に更新
              </Button>
            </div>
          </div>
        </search>

        <TaskList
          tasks={tasks}
          isLoading={isLoading}
          isUpdating={isUpdating}
          errorMessage={errorMessage}
          hasActiveFilters={hasActiveFilters}
          onRetry={refetch}
          onToggleStatus={handleToggleStatus}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>

      {hasLoadedEditDialog || editingTask ? (
        <TaskEditDialog
          task={editingTask}
          isSaving={isUpdating}
          onClose={handleCloseEdit}
          onSave={handleSaveEdit}
        />
      ) : null}

      {hasLoadedDeleteDialog || deletingTask ? (
        <TaskDeleteDialog
          task={deletingTask}
          isDeleting={isDeleting}
          onClose={handleCloseDelete}
          onConfirm={handleConfirmDelete}
        />
      ) : null}

      <ToastViewport toaster={toaster} />
    </div>
  );
}
