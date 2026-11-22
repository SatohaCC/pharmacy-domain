"use client";

import * as stylex from "@stylexjs/stylex";
import { type RefObject, useRef, useState } from "react";
import { Alert } from "@/shared/ui/alert/Alert";
import { Button } from "@/shared/ui/button/Button";
import {
  DialogBody,
  DialogCloseButton,
  DialogCloseIconButton,
  DialogHeader,
  DialogHeaderText,
  DialogHeading,
  DialogPanel,
  DialogRoot,
  DialogSummary,
} from "@/shared/ui/dialog/Dialog";
import { Spinner } from "@/shared/ui/spinner/Spinner";
import { taskDeleteDialogStyles as s } from "./TaskDeleteDialog.styles";
import type { TaskItem } from "./tasksApi";

export interface TaskDeleteDialogProps {
  task: TaskItem | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: (task: TaskItem) => Promise<void>;
}

function TaskDeleteDialogBody({
  task,
  isDeleting,
  cancelButtonRef,
  onConfirm,
}: {
  task: TaskItem;
  isDeleting: boolean;
  cancelButtonRef: RefObject<HTMLButtonElement | null>;
  onConfirm: (task: TaskItem) => Promise<void>;
}) {
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setDeleteError(null);
    try {
      await onConfirm(task);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "タスクの削除に失敗しました。");
    }
  };

  return (
    <div {...stylex.props(s.body)}>
      {deleteError ? (
        <Alert tone="error" title="削除できませんでした">
          {deleteError}
        </Alert>
      ) : null}
      <div {...stylex.props(s.actions)}>
        <DialogCloseButton ref={cancelButtonRef} variant="text" disabled={isDeleting}>
          キャンセル
        </DialogCloseButton>
        <Button type="button" variant="filled" disabled={isDeleting} onClick={handleConfirm}>
          {isDeleting ? (
            <>
              <Spinner size="sm" decorative />
              削除中…
            </>
          ) : (
            "削除する"
          )}
        </Button>
      </div>
    </div>
  );
}

/** タスク削除前に確認を求めるモーダルダイアログ。 */
export function TaskDeleteDialog({ task, isDeleting, onClose, onConfirm }: TaskDeleteDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <DialogRoot
      open={task !== null}
      dismissible={!isDeleting}
      onOpenChange={(open, details) => {
        if (!open) {
          if (isDeleting) {
            details.cancel();
            return;
          }
          onClose();
        }
      }}
    >
      <DialogPanel initialFocus={() => cancelButtonRef.current}>
        <DialogHeader>
          <DialogHeaderText>
            <DialogHeading>タスクを削除</DialogHeading>
            <DialogSummary>
              {task
                ? `「${task.title}」を削除します。削除すると元に戻せません。`
                : "このタスクを削除します。"}
            </DialogSummary>
          </DialogHeaderText>
          {!isDeleting ? <DialogCloseIconButton label="閉じる" /> : null}
        </DialogHeader>
        {task ? (
          <DialogBody>
            <TaskDeleteDialogBody
              key={task.id}
              task={task}
              isDeleting={isDeleting}
              cancelButtonRef={cancelButtonRef}
              onConfirm={onConfirm}
            />
          </DialogBody>
        ) : null}
      </DialogPanel>
    </DialogRoot>
  );
}
