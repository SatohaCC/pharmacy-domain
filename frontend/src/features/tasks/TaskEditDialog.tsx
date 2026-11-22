"use client";

import * as stylex from "@stylexjs/stylex";
import { type RefObject, useCallback, useEffect, useId, useRef, useState } from "react";
import { Alert } from "@/shared/ui/alert/Alert";
import { Button } from "@/shared/ui/button/Button";
import {
  DialogBody,
  DialogCloseIconButton,
  DialogHeader,
  DialogHeaderText,
  DialogHeading,
  DialogPanel,
  DialogRoot,
  DialogSummary,
} from "@/shared/ui/dialog/Dialog";
import { RadioGroup } from "@/shared/ui/radio-group/RadioGroup";
import { Spinner } from "@/shared/ui/spinner/Spinner";
import { Switch } from "@/shared/ui/switch/Switch";
import { TextField } from "@/shared/ui/text-field/TextField";
import { Textarea } from "@/shared/ui/textarea/Textarea";
import { taskEditDialogStyles as s } from "./TaskEditDialog.styles";
import {
  extractFieldErrorMessage,
  type TaskItem,
  type TaskPriority,
  type TaskUpdateInput,
} from "./tasksApi";

const PRIORITY_ITEMS = [
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
] as const;

export interface TaskEditDialogProps {
  task: TaskItem | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (taskId: string, patch: TaskUpdateInput) => Promise<void>;
}

function TaskEditFormBody({
  task,
  isSaving,
  titleInputRef,
  onSave,
  onDirtyChange,
  onImmediateCancel,
}: {
  task: TaskItem;
  isSaving: boolean;
  titleInputRef: RefObject<HTMLInputElement | null>;
  onSave: (taskId: string, patch: TaskUpdateInput) => Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
  onImmediateCancel: () => void;
}) {
  const titleId = useId();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [isDone, setIsDone] = useState(task.status === "done");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isDirty =
    title !== task.title ||
    description !== task.description ||
    priority !== task.priority ||
    isDone !== (task.status === "done");

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setTitleError("タイトルを入力してください");
      titleInputRef.current?.focus();
      return;
    }

    setTitleError(null);
    try {
      await onSave(task.id, {
        title: trimmedTitle,
        description: description.trim(),
        priority,
        status: isDone ? "done" : "open",
      });
    } catch (error) {
      const fieldError = extractFieldErrorMessage(error, "title");
      if (fieldError) {
        setTitleError(fieldError);
        titleInputRef.current?.focus();
        return;
      }
      setSubmitError(error instanceof Error ? error.message : "タスクの更新に失敗しました。");
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate {...stylex.props(s.form)}>
      {submitError ? (
        <Alert tone="error" title="更新できませんでした">
          {submitError}
        </Alert>
      ) : null}

      <TextField
        id={titleId}
        inputRef={titleInputRef}
        label="タイトル"
        name="title"
        required
        autoComplete="off"
        enterKeyHint="next"
        maxLength={120}
        value={title}
        onValueChange={(nextValue) => {
          setTitle(nextValue);
          if (titleError) {
            setTitleError(null);
          }
        }}
        errorMessage={titleError ?? undefined}
      />

      <Textarea
        label="詳細メモ"
        name="description"
        rows={3}
        maxLength={1000}
        value={description}
        onValueChange={setDescription}
      />

      <RadioGroup
        label="優先度"
        name="priority"
        orientation="horizontal"
        items={PRIORITY_ITEMS}
        value={priority}
        onValueChange={(nextValue) => {
          if (nextValue === "low" || nextValue === "medium" || nextValue === "high") {
            setPriority(nextValue);
          }
        }}
      />

      <Switch label="完了済みとしてマーク" checked={isDone} onCheckedChange={setIsDone} />

      <div {...stylex.props(s.actions)}>
        <Button type="button" variant="text" disabled={isSaving} onClick={onImmediateCancel}>
          キャンセル
        </Button>
        <Button type="submit" variant="filled" disabled={isSaving}>
          {isSaving ? (
            <>
              <Spinner size="sm" decorative />
              保存中…
            </>
          ) : (
            "変更を保存"
          )}
        </Button>
      </div>
    </form>
  );
}

/** タスクの内容を編集するモーダルダイアログ。 */
export function TaskEditDialog({ task, isSaving, onClose, onSave }: TaskEditDialogProps) {
  const discardMessageId = useId();
  const titleInputRef = useRef<HTMLInputElement>(null);
  const continueEditingButtonRef = useRef<HTMLButtonElement>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [trackedTaskId, setTrackedTaskId] = useState<string | null>(task?.id ?? null);

  const currentTaskId = task?.id ?? null;
  if (currentTaskId !== trackedTaskId) {
    setTrackedTaskId(currentTaskId);
    setIsDirty(false);
    setShowDiscardConfirm(false);
  }

  const handleDirtyChange = useCallback((dirty: boolean) => {
    setIsDirty(dirty);
    if (!dirty) {
      setShowDiscardConfirm(false);
    }
  }, []);

  useEffect(() => {
    if (!showDiscardConfirm) {
      return;
    }
    continueEditingButtonRef.current?.focus();
  }, [showDiscardConfirm]);

  useEffect(() => {
    if (!task || !isDirty || isSaving) {
      return;
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [task, isDirty, isSaving]);

  const handleImmediateClose = useCallback(() => {
    if (isSaving) {
      return;
    }
    setShowDiscardConfirm(false);
    setIsDirty(false);
    onClose();
  }, [isSaving, onClose]);

  return (
    <DialogRoot
      open={task !== null}
      dismissible={!isSaving}
      onOpenChange={(open, details) => {
        if (!open) {
          if (isSaving) {
            details.cancel();
            return;
          }
          if (isDirty) {
            details.cancel();
            if (showDiscardConfirm) {
              continueEditingButtonRef.current?.focus();
            } else {
              setShowDiscardConfirm(true);
            }
            return;
          }
          setShowDiscardConfirm(false);
          setIsDirty(false);
          onClose();
        }
      }}
    >
      <DialogPanel initialFocus={() => titleInputRef.current}>
        <DialogHeader>
          <DialogHeaderText>
            <DialogHeading>タスクを編集</DialogHeading>
            <DialogSummary>タイトル・詳細メモ・優先度・完了状態を変更できます。</DialogSummary>
          </DialogHeaderText>
          {!isSaving ? <DialogCloseIconButton label="閉じる" /> : null}
        </DialogHeader>
        {task ? (
          <DialogBody style={s.bodyStack}>
            <TaskEditFormBody
              key={task.id}
              task={task}
              isSaving={isSaving}
              titleInputRef={titleInputRef}
              onSave={onSave}
              onDirtyChange={handleDirtyChange}
              onImmediateCancel={handleImmediateClose}
            />
            {showDiscardConfirm ? (
              <Alert
                tone="warning"
                title="未保存の変更があります"
                action={
                  <div {...stylex.props(s.confirmActions)}>
                    <Button
                      ref={continueEditingButtonRef}
                      type="button"
                      variant="text"
                      size="sm"
                      disabled={isSaving}
                      aria-describedby={discardMessageId}
                      onClick={() => {
                        setShowDiscardConfirm(false);
                        titleInputRef.current?.focus();
                      }}
                    >
                      編集を続ける
                    </Button>
                    <Button
                      type="button"
                      variant="filled"
                      size="sm"
                      disabled={isSaving}
                      onClick={handleImmediateClose}
                    >
                      変更を破棄して閉じる
                    </Button>
                  </div>
                }
              >
                <span id={discardMessageId}>変更を破棄して閉じますか？</span>
              </Alert>
            ) : null}
          </DialogBody>
        ) : null}
      </DialogPanel>
    </DialogRoot>
  );
}
