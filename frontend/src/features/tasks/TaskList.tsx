"use client";

import * as stylex from "@stylexjs/stylex";
import { memo } from "react";
import { Alert } from "@/shared/ui/alert/Alert";
import { Badge } from "@/shared/ui/badge/Badge";
import { Button } from "@/shared/ui/button/Button";
import { Checkbox } from "@/shared/ui/checkbox/Checkbox";
import { Menu } from "@/shared/ui/menu/Menu";
import { Skeleton } from "@/shared/ui/skeleton/Skeleton";
import { Spinner } from "@/shared/ui/spinner/Spinner";
import { taskListStyles as s } from "./TaskList.styles";
import type { TaskItem, TaskPriority, TaskStatus } from "./tasksApi";

/** 初期ビューポート内に収まる先頭件数には content-visibility: auto を適用しない。 */
const DEFERRED_RENDER_START_INDEX = 6;

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "優先度: 低",
  medium: "優先度: 中",
  high: "優先度: 高",
};

function priorityBadgeTone(priority: TaskPriority): "neutral" | "danger" {
  return priority === "high" ? "danger" : "neutral";
}

export interface TaskListProps {
  tasks: readonly TaskItem[];
  isLoading: boolean;
  isUpdating: boolean;
  errorMessage: string | null;
  hasActiveFilters: boolean;
  onRetry: () => void;
  onToggleStatus: (task: TaskItem, nextStatus: TaskStatus) => void;
  onEdit: (task: TaskItem) => void;
  onDelete: (task: TaskItem) => void;
}

/** タスク一覧・状態切り替え・行操作メニューを描画する。 */
export const TaskList = memo(function TaskList({
  tasks,
  isLoading,
  isUpdating,
  errorMessage,
  hasActiveFilters,
  onRetry,
  onToggleStatus,
  onEdit,
  onDelete,
}: TaskListProps) {
  if (isLoading) {
    return (
      <div {...stylex.props(s.loadingWrap)}>
        <Spinner showLabel label="タスクを読み込んでいます…" />
        <Skeleton variant="rectangular" height={84} />
        <Skeleton variant="rectangular" height={84} />
        <Skeleton variant="rectangular" height={84} />
      </div>
    );
  }

  if (errorMessage) {
    return (
      <Alert
        tone="error"
        title="タスク一覧を読み込めませんでした"
        action={
          <Button variant="outlined" size="sm" onClick={onRetry}>
            再読み込み
          </Button>
        }
      >
        {errorMessage}
      </Alert>
    );
  }

  if (tasks.length === 0) {
    return (
      <Alert
        tone="info"
        title={hasActiveFilters ? "条件に一致するタスクはありません" : "タスクはまだありません"}
      >
        {hasActiveFilters
          ? "絞り込み条件を変更するか、リセットしてください。"
          : "左側の作成フォームから最初のタスクを追加できます。"}
      </Alert>
    );
  }

  return (
    // biome-ignore lint/a11y/noRedundantRoles: list-style: none 適用時も Safari でリスト役割を保持するため。
    <ul role="list" {...stylex.props(s.list)}>
      {tasks.map((task, index) => {
        const isDone = task.status === "done";
        return (
          <li
            key={task.id}
            {...stylex.props(s.item, index >= DEFERRED_RENDER_START_INDEX && s.itemDeferred)}
          >
            <div {...stylex.props(s.checkboxWrap)}>
              <Checkbox
                aria-label={
                  isDone ? `「${task.title}」を未完了に戻す` : `「${task.title}」を完了にする`
                }
                checked={isDone}
                disabled={isUpdating}
                onCheckedChange={(checked) => {
                  if (typeof checked === "boolean") {
                    onToggleStatus(task, checked ? "done" : "open");
                  }
                }}
              />
            </div>

            <div {...stylex.props(s.content)}>
              <div {...stylex.props(s.titleRow)}>
                <span {...stylex.props(s.title, isDone && s.titleDone)}>{task.title}</span>
                <div {...stylex.props(s.badges)}>
                  <Badge tone={isDone ? "success" : "neutral"}>{isDone ? "完了" : "未完了"}</Badge>
                  <Badge tone={priorityBadgeTone(task.priority)}>
                    {PRIORITY_LABELS[task.priority]}
                  </Badge>
                </div>
              </div>
              {task.description ? <p {...stylex.props(s.description)}>{task.description}</p> : null}
            </div>

            <div {...stylex.props(s.actions)}>
              <Menu
                triggerLabel="操作"
                triggerAriaLabel={`「${task.title}」の操作`}
                triggerSize="sm"
                align="end"
                items={[
                  { value: "edit", label: "編集" },
                  { value: "toggle", label: isDone ? "未完了に戻す" : "完了にする" },
                  { type: "separator", id: `sep-${task.id}` },
                  { value: "delete", label: "削除", destructive: true },
                ]}
                onAction={(actionValue) => {
                  if (actionValue === "edit") {
                    onEdit(task);
                  } else if (actionValue === "toggle") {
                    onToggleStatus(task, isDone ? "open" : "done");
                  } else if (actionValue === "delete") {
                    onDelete(task);
                  }
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
});
