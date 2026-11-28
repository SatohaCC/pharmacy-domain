"use client";

import { useAppMutation } from "@/shared/lib/query/useAppMutation";
import { useAppQuery } from "@/shared/lib/query/useAppQuery";
import {
  changeCorporationStatus,
  changeCorporationUsageStatus,
  correctCorporationHistory,
  createCorporation,
  fetchCorporationAt,
  fetchCorporationHistory,
  fetchCorporations,
  updateCorporation,
} from "./api";
import type { CorporationCategory, CorporationListFilter, CorporationUsageStatus } from "./schemas";

export const corporationKeys = {
  all: ["corporations"] as const,
  list: (filter: CorporationListFilter) =>
    [
      "corporations",
      "list",
      filter.q?.trim() ?? "",
      filter.category ?? "all",
      filter.status ?? "all",
      filter.usage_status ?? "all",
    ] as const,
  history: (corporationId: string) => ["corporations", "history", corporationId] as const,
  snapshot: (corporationId: string, asOf?: string, recordedAsOf?: string) =>
    ["corporations", "snapshot", corporationId, asOf ?? "", recordedAsOf ?? ""] as const,
};

/** 法人一覧を取得する。 */
export function useCorporations(filter: CorporationListFilter, enabled: boolean) {
  return useAppQuery({
    queryKey: corporationKeys.list(filter),
    queryFn: ({ signal }) => fetchCorporations(filter, signal),
    enabled,
    retainPreviousData: true,
    retry: false,
  });
}

/** 新しい企業（法人・個人開設者）を登録する。 */
export function useCreateCorporation() {
  return useAppMutation({
    mutationFn: (input: {
      category: CorporationCategory;
      name: string;
      representative_name: string;
      corporate_number?: string | null;
      address?: string;
      valid_from?: string | null;
      valid_to?: string | null;
      evidence?: string | null;
      usage_status?: CorporationUsageStatus;
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
        representative_name?: string | null;
        corporate_number?: string | null;
        address?: string | null;
        valid_from?: string | null;
        valid_to?: string | null;
        evidence?: string | null;
      };
    }) => updateCorporation(input.corporationId, input.payload),
    invalidateKeys: [corporationKeys.all],
  });
}

/** 指定企業の変更履歴を取得する。 */
export function useCorporationHistory(corporationId: string, enabled: boolean) {
  return useAppQuery({
    queryKey: corporationKeys.history(corporationId),
    queryFn: ({ signal }) => fetchCorporationHistory(corporationId, signal),
    enabled,
    retry: false,
  });
}

/** 指定企業の指定時点スナップショットを取得する。 */
export function useCorporationAt(
  corporationId: string,
  params: { as_of?: string; recorded_as_of?: string },
  enabled: boolean,
) {
  return useAppQuery({
    queryKey: corporationKeys.snapshot(corporationId, params.as_of, params.recorded_as_of),
    queryFn: ({ signal }) => fetchCorporationAt(corporationId, params, signal),
    enabled,
    retry: false,
  });
}

/** 指定企業の存続状態を変更（解散・吸収合併）する。 */
export function useChangeCorporationStatus() {
  return useAppMutation({
    mutationFn: (input: {
      corporationId: string;
      payload: {
        status: "dissolved" | "merged_out";
        effective_date?: string | null;
        surviving_corporation_id?: string | null;
        evidence?: string | null;
      };
    }) => changeCorporationStatus(input.corporationId, input.payload),
    invalidateKeys: [corporationKeys.all],
  });
}

/** 指定企業の過去履歴を訂正する。 */
export function useCorrectCorporationHistory() {
  return useAppMutation({
    mutationFn: (input: {
      corporationId: string;
      payload: {
        as_of: string;
        name?: string | null;
        representative_name?: string | null;
        corporate_number?: string | null;
        address?: string | null;
        valid_from?: string | null;
        valid_to?: string | null;
        evidence: string;
      };
    }) => correctCorporationHistory(input.corporationId, input.payload),
    invalidateKeys: [corporationKeys.all],
  });
}

/** 指定企業のシステム利用状態を変更する。 */
export function useChangeCorporationUsageStatus() {
  return useAppMutation({
    mutationFn: (input: { corporationId: string; usageStatus: CorporationUsageStatus }) =>
      changeCorporationUsageStatus(input.corporationId, input.usageStatus),
    invalidateKeys: [corporationKeys.all],
  });
}
