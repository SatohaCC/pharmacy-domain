"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

export interface AppMutationOptions<TData, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  invalidateKeys?: readonly (readonly unknown[])[];
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: Error, variables: TVariables) => void;
}

function normalizeMutationError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/** React Query の useMutation をラップし、更新系リクエストとキャッシュ無効化を共通化する。 */
export function useAppMutation<TData, TVariables = void>({
  mutationFn,
  invalidateKeys,
  onSuccess,
  onError,
}: AppMutationOptions<TData, TVariables>) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn,
    onSuccess: async (data, variables) => {
      if (invalidateKeys?.length) {
        await Promise.all(
          invalidateKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
        );
      }
      onSuccess?.(data, variables);
    },
    onError: (error, variables) => {
      onError?.(normalizeMutationError(error), variables);
    },
  });

  const normalizedError =
    mutation.error !== null && mutation.error !== undefined
      ? normalizeMutationError(mutation.error)
      : null;

  return {
    data: mutation.data ?? null,
    error: normalizedError,
    errorMessage: normalizedError ? normalizedError.message : null,
    isPending: mutation.isPending,
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    reset: mutation.reset,
  };
}
