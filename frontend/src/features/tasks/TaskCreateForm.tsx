"use client";

import * as stylex from "@stylexjs/stylex";
import { memo, useId, useRef, useState } from "react";
import { Alert } from "@/shared/ui/alert/Alert";
import { Button } from "@/shared/ui/button/Button";
import { RadioGroup } from "@/shared/ui/radio-group/RadioGroup";
import { Spinner } from "@/shared/ui/spinner/Spinner";
import { TextField } from "@/shared/ui/text-field/TextField";
import { Textarea } from "@/shared/ui/textarea/Textarea";
import { taskCreateFormStyles as s } from "./TaskCreateForm.styles";
import { extractFieldErrorMessage, type TaskCreateInput, type TaskPriority } from "./tasksApi";

const PRIORITY_ITEMS = [
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
] as const;

export interface TaskCreateFormProps {
  isSubmitting: boolean;
  onCreate: (input: TaskCreateInput) => Promise<void>;
}

/** 新規タスクを作成するフォームコンポーネント。 */
export const TaskCreateForm = memo(function TaskCreateForm({
  isSubmitting,
  onCreate,
}: TaskCreateFormProps) {
  const headingId = useId();
  const titleId = useId();
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
    // 送信中も入力を受け付けるため、送信時点の値を控えておき完了後の初期化判定に使う。
    const submitted = { title, description, priority };
    try {
      await onCreate({
        title: trimmedTitle,
        description: description.trim(),
        priority,
      });
      // 送信後に書き換えられた項目は未保存の入力として残し、送信時のままの項目だけ初期化する。
      setTitle((current) => (current === submitted.title ? "" : current));
      setDescription((current) => (current === submitted.description ? "" : current));
      setPriority((current) => (current === submitted.priority ? "medium" : current));
    } catch (error) {
      const fieldError = extractFieldErrorMessage(error, "title");
      if (fieldError) {
        setTitleError(fieldError);
        titleInputRef.current?.focus();
        return;
      }
      setSubmitError(error instanceof Error ? error.message : "タスクの作成に失敗しました。");
    }
  };

  return (
    <div {...stylex.props(s.card)}>
      <div {...stylex.props(s.header)}>
        <h2 id={headingId} {...stylex.props(s.heading)}>
          タスクを作成
        </h2>
        <p {...stylex.props(s.requiredNote)}>「*」は必須項目です。</p>
      </div>

      <form
        aria-labelledby={headingId}
        onSubmit={handleSubmit}
        noValidate
        {...stylex.props(s.form)}
      >
        {submitError ? (
          <Alert tone="error" title="作成できませんでした">
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
          placeholder="例: SQLite 永続化の動作確認…"
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
          placeholder="例: 確認観点や補足手順…"
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

        <div {...stylex.props(s.actions)}>
          <Button type="submit" variant="filled" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Spinner size="sm" decorative />
                作成中…
              </>
            ) : (
              "タスクを追加"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
});
