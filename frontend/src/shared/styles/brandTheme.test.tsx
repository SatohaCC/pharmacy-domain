import * as stylex from "@stylexjs/stylex";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/shared/ui/button/Button";
import { indigoBrandTheme } from "./brandTheme";

describe("indigoBrandTheme", () => {
  it("stylex.createTheme で生成したテーマクラスをコンテナへ適用し、配下の UI を描画できる", () => {
    render(
      <div data-testid="themed-root" {...stylex.props(indigoBrandTheme)}>
        <Button variant="filled">テーマ確認</Button>
      </div>,
    );

    const root = screen.getByTestId("themed-root");
    expect(root).toHaveAttribute("class", expect.stringMatching(/\S+/));
    expect(screen.getByRole("button", { name: "テーマ確認" })).toBeInTheDocument();
  });
});
