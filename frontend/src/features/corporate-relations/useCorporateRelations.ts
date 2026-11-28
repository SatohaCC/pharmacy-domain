"use client";

import { useAppMutation } from "@/shared/lib/query/useAppMutation";
import { useAppQuery } from "@/shared/lib/query/useAppQuery";
import {
  correctCorporateRelation,
  endCorporateRelation,
  fetchCorporateRelationHistory,
  fetchCorporateRelations,
  registerCorporateRelation,
} from "./api";
import type { CorporateRelationListFilter, RelationType } from "./schemas";

export const corporateRelationKeys = {
  all: ["corporate-relations"] as const,
  list: (filter: CorporateRelationListFilter) =>
    [
      "corporate-relations",
      "list",
      filter.corporation_id ?? "",
      filter.as_of ?? "",
      filter.relation_type ?? "all",
    ] as const,
  history: (relationId: string) => ["corporate-relations", "history", relationId] as const,
};

/** 法人間関係一覧を取得する。 */
export function useCorporateRelations(filter: CorporateRelationListFilter, enabled: boolean) {
  return useAppQuery({
    queryKey: corporateRelationKeys.list(filter),
    queryFn: ({ signal }) => fetchCorporateRelations(filter, signal),
    enabled,
    retainPreviousData: true,
    retry: false,
  });
}

/** 法人間関係の改訂履歴を取得する。 */
export function useCorporateRelationHistory(relationId: string, enabled: boolean) {
  return useAppQuery({
    queryKey: corporateRelationKeys.history(relationId),
    queryFn: ({ signal }) => fetchCorporateRelationHistory(relationId, signal),
    enabled,
    retry: false,
  });
}

/** 法人間関係を新規登録する。 */
export function useRegisterCorporateRelation() {
  return useAppMutation({
    mutationFn: (input: {
      source_corporation_id: string;
      target_corporation_id: string;
      relation_type: RelationType;
      valid_from: string;
      valid_to?: string | null;
      evidence: string;
    }) => registerCorporateRelation(input),
    invalidateKeys: [corporateRelationKeys.all],
  });
}

/** 法人間関係を訂正する。 */
export function useCorrectCorporateRelation() {
  return useAppMutation({
    mutationFn: (input: {
      relationId: string;
      payload: {
        valid_from?: string;
        valid_to?: string | null;
        evidence?: string;
      };
    }) => correctCorporateRelation(input.relationId, input.payload),
    invalidateKeys: [corporateRelationKeys.all],
  });
}

/** 法人間関係を終了する。 */
export function useEndCorporateRelation() {
  return useAppMutation({
    mutationFn: (input: { relationId: string; validTo: string }) =>
      endCorporateRelation(input.relationId, input.validTo),
    invalidateKeys: [corporateRelationKeys.all],
  });
}
