import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppMutation } from "./useAppMutation";

let activeQueryClient: QueryClient;

function TestWrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={activeQueryClient}>{children}</QueryClientProvider>;
}

describe("useAppMutation", () => {
  beforeEach(() => {
    activeQueryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  it("更新成功時に isPending・data・キャッシュ無効化・onSuccess が動作する", async () => {
    const invalidateSpy = vi.spyOn(activeQueryClient, "invalidateQueries");

    let resolveMutation!: (value: { id: number }) => void;
    const mutationFn = vi.fn(
      (_name: string) =>
        new Promise<{ id: number }>((resolve) => {
          resolveMutation = resolve;
        }),
    );
    const onSuccess = vi.fn();

    const { result } = renderHook(
      () =>
        useAppMutation({
          mutationFn,
          invalidateKeys: [["items"], ["health"]],
          onSuccess,
        }),
      { wrapper: TestWrapper },
    );

    expect(result.current.isPending).toBe(false);
    expect(result.current.data).toBeNull();

    act(() => {
      result.current.mutate("sample");
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    await act(async () => {
      resolveMutation({ id: 10 });
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
      expect(result.current.data).toEqual({ id: 10 });
    });

    expect(mutationFn).toHaveBeenCalledWith("sample", expect.anything());
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["items"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["health"] });
    expect(onSuccess).toHaveBeenCalledWith({ id: 10 }, "sample");
  });

  it("失敗時に非 Error も含めて Error に正規化し、reset で状態をクリアできる", async () => {
    const onError = vi.fn();

    const { result } = renderHook(
      () =>
        useAppMutation<string, string>({
          mutationFn: async () => {
            throw "unexpected string error";
          },
          onError,
        }),
      { wrapper: TestWrapper },
    );

    let rejected: unknown = null;
    await act(async () => {
      try {
        await result.current.mutateAsync("payload");
      } catch (error) {
        rejected = error;
      }
    });

    expect(rejected).toBe("unexpected string error");
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].message).toBe("unexpected string error");
    expect(onError.mock.calls[0][1]).toBe("payload");

    await waitFor(() => {
      expect(result.current.errorMessage).toBe("unexpected string error");
    });
    expect(result.current.error).toBeInstanceOf(Error);

    act(() => {
      result.current.reset();
    });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
      expect(result.current.errorMessage).toBeNull();
    });
  });
});
