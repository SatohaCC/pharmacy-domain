"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

/** 指定した queryKey 配下のキャッシュを明示的に削除する関数を返す。 */
export function useRemoveQueries() {
  const queryClient = useQueryClient();
  return useCallback(
    (queryKey: readonly unknown[]) => {
      queryClient.removeQueries({ queryKey });
    },
    [queryClient],
  );
}
