"use client";

import { useAppMutation } from "@/shared/lib/query/useAppMutation";
import { useAppQuery } from "@/shared/lib/query/useAppQuery";
import { createCorporation, fetchCorporations, updateCorporation } from "./api";
import type { CorporationCategory, CorporationListFilter } from "./schemas";

export const corporationKeys = {
  all: ["corporations"] as const,
  list: (filter: CorporationListFilter) =>
    [
      "corporations",
      "list",
      filter.q?.trim() ?? "",
      filter.category ?? "all",
      filter.status ?? "all",
    ] as const,
};

/** 法人一覧を取得する。 */
export function useCorporations(filter: CorporationListFilter, enabled: boolean) {
  return useAppQuery({
    queryKey: corporationKeys.list(filter),
    queryFn: ({ signal }) => fetchCorporations(filter, signal),
    enabled,
    retry: false,
  });
}

/** 新しい企業（法人・個人開設者）を登録する。 */
export function useCreateCorporation() {
  return useAppMutation({
    mutationFn: (input: {
      category: CorporationCategory;
      name: string;
      corporate_number?: string | null;
      address?: string;
      valid_from?: string | null;
      evidence?: string | null;
    }) => createCorporation(input),
    invalidateKeys: [corporationKeys.all],
  });
}

/** 指定企業の基本情報を更新する。 */
export function useUpdateCorporation() {
  return useAppMutation({
    mutationFn: (input: {
      corporationId: string;
      payload: {
        name?: string | null;
        corporate_number?: string | null;
        address?: string | null;
        valid_from?: string | null;
        evidence?: string | null;
      };
    }) => updateCorporation(input.corporationId, input.payload),
    invalidateKeys: [corporationKeys.all],
  });
}
