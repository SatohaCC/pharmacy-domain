import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgent } from "@ui-sdk/react/agent";
import { describe, expect, it, vi } from "vitest";
import { StatusCard } from "./StatusCard";

const agent = createAgent();

describe("StatusCard", () => {
  it("renders status label, badge, and calls onAction on button press", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();

    render(
      <StatusCard
        label="Backend API"
        badgeText="ok"
        badgeTone="success"
        actionLabel="Refresh Status"
        onAction={onAction}
      />,
    );

    expect(screen.getByText("Backend API")).toBeInTheDocument();
    expect(screen.getByText("ok")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Refresh Status" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("エージェントが名前からステータス更新ボタンを押せる", async () => {
    const onAction = vi.fn();

    render(
      <StatusCard
        label="Backend API"
        badgeText="ok"
        badgeTone="success"
        actionLabel="Refresh Status"
        onAction={onAction}
      />,
    );

    const components = agent
      .snapshot()
      .filter((entry) => !entry.offPage && entry.component !== "more");
    for (const entry of components) {
      expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy();
    }
    expect(components.map((entry) => entry.label)).toContain("Refresh Status");

    const result = await agent.act({
      steps: [{ ref: "Refresh Status", action: "press" }],
    });
    expect(result.ok, result.error?.message).toBe(true);
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
