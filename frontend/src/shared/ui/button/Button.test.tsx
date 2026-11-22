import * as stylex from "@stylexjs/stylex";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

const overrides = stylex.create({ width: (width: number) => ({ width }) });

describe("Button", () => {
  it("renders children and invokes onClick when pressed", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<Button onClick={onClick}>Refresh</Button>);

    const button = screen.getByRole("button", { name: "Refresh" });
    await user.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not invoke onClick when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <Button disabled onClick={onClick}>
        Refresh
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Refresh" });
    expect(button).toBeDisabled();
    await user.click(button);

    expect(onClick).not.toHaveBeenCalled();
  });

  it("forwards inline variables of a dynamic StyleX override", () => {
    render(<Button style={overrides.width(180)}>Save</Button>);

    expect(screen.getByRole("button", { name: "Save" }).getAttribute("style")).toMatch(
      /--[\w-]+:\s*180px/,
    );
  });
});
