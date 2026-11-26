"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

export interface AppQueryOptions<TData> {
  queryKey: readonly unknown[];
  queryFn: (context: { signal: AbortSignal }) => Promise<TData>;
  enabled?: boolean;
  initialData?: TData;
  retainPreviousData?: boolean;
  retry?: boolean | number;
}

/** React Query の useQuery をラップし、初回読込・再取得・構造化エラーを提供する。 */
export function useAppQuery<TData>({
  queryKey,
  queryFn,
  enabled,
  initialData,
  retainPreviousData,
  retry,
}: AppQueryOptions<TData>) {
  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: ({ signal }) => queryFn({ signal }),
    enabled,
    ...(retry !== undefined ? { retry } : {}),
    ...(retainPreviousData ? { placeholderData: keepPreviousData } : {}),
    ...(initialData !== undefined ? { initialData } : {}),
  });

  const normalizedError = error instanceof Error ? error : null;
  const stableRefetch = useCallback(() => {
    void refetch();
  }, [refetch]);

  return {
    data: data ?? null,
    error: normalizedError,
    errorMessage: normalizedError ? normalizedError.message : null,
    isLoading,
    isFetching,
    refetch: stableRefetch,
  };
}
