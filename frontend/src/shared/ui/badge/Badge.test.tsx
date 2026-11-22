import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("renders provided text content", () => {
    render(<Badge tone="success">ok</Badge>);
    expect(screen.getByText("ok")).toBeInTheDocument();
  });
});
