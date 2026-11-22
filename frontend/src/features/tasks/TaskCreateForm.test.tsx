import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TaskCreateForm } from "./TaskCreateForm";
import type { TaskCreateInput } from "./tasksApi";

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("TaskCreateForm", () => {
  it("作成完了後、送信時のままの項目は初期化し、送信中に書き換えた項目は保持する", async () => {
    const user = userEvent.setup();
    const deferred = createDeferred();
    const onCreate = vi.fn((_input: TaskCreateInput) => deferred.promise);

    const { rerender } = render(<TaskCreateForm isSubmitting={false} onCreate={onCreate} />);

    const titleInput = screen.getByRole("textbox", { name: /タイトル/ });
    const descriptionInput = screen.getByRole("textbox", { name: "詳細メモ" });
    await user.type(titleInput, "最初のタスク");
    await user.type(descriptionInput, "送信したメモ");
    await user.click(screen.getByRole("radio", { name: "高" }));
    await user.click(screen.getByRole("button", { name: "タスクを追加" }));

    expect(onCreate).toHaveBeenCalledWith({
      title: "最初のタスク",
      description: "送信したメモ",
      priority: "high",
    });

    // 作成リクエストの完了待ちの間に、次のタスクのタイトルと優先度を入力し始める。
    rerender(<TaskCreateForm isSubmitting onCreate={onCreate} />);
    await user.clear(titleInput);
    await user.type(titleInput, "次のタスク");
    await user.click(screen.getByRole("radio", { name: "低" }));

    deferred.resolve();
    rerender(<TaskCreateForm isSubmitting={false} onCreate={onCreate} />);

    await waitFor(() => {
      expect(descriptionInput).toHaveValue("");
    });
    expect(titleInput).toHaveValue("次のタスク");
    expect(screen.getByRole("radio", { name: "低" })).toHaveAttribute("aria-checked", "true");
  });

  it("前後に空白のある入力はトリムして送信し、変更がなければ完了後に全項目を初期化する", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn(async (_input: TaskCreateInput) => {});

    render(<TaskCreateForm isSubmitting={false} onCreate={onCreate} />);

    const titleInput = screen.getByRole("textbox", { name: /タイトル/ });
    const descriptionInput = screen.getByRole("textbox", { name: "詳細メモ" });
    await user.type(titleInput, "  空白付きタスク  ");
    await user.type(descriptionInput, " メモ ");
    await user.click(screen.getByRole("radio", { name: "高" }));
    await user.click(screen.getByRole("button", { name: "タスクを追加" }));

    expect(onCreate).toHaveBeenCalledWith({
      title: "空白付きタスク",
      description: "メモ",
      priority: "high",
    });
    await waitFor(() => {
      expect(titleInput).toHaveValue("");
    });
    expect(descriptionInput).toHaveValue("");
    expect(screen.getByRole("radio", { name: "中" })).toHaveAttribute("aria-checked", "true");
  });
});
