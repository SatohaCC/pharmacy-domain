import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryProvider } from "@/shared/lib/query/QueryProvider";
import { useHealthStatus } from "./useHealthStatus";

function wrapper({ children }: { children: ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>;
}

describe("useHealthStatus", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("ヘルス API の正常レスポンスを取得できる", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "ok", service: "template-backend" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { result } = renderHook(() => useHealthStatus(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.data).toEqual({ status: "ok", service: "template-backend" });
    expect(result.current.error).toBeNull();
  });

  it("不正なレスポンス形式をエラーとして報告する", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "ng" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { result } = renderHook(() => useHealthStatus(), { wrapper });

    await waitFor(() => {
      expect(result.current.error).toBe("Invalid health response");
    });
    expect(result.current.data).toBeNull();
  });
});
