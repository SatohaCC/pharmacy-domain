import { authApiRequest } from "@/features/auth/api";
import { parseZodResponse } from "@/shared/lib/api/zodResponse";
import { formatBusinessDateInTokyo } from "@/shared/lib/date/businessDate";
import {
  type Corporation,
  type CorporationCategory,
  type CorporationHistoryRecord,
  type CorporationList,
  type CorporationListFilter,
  type CorporationUsageStatus,
  corporationHistoryListSchema,
  corporationHistoryRecordSchema,
  corporationListSchema,
  corporationSchema,
} from "./schemas";

/** 条件に一致する法人・個人開設者一覧を取得する。 */
export function fetchCorporations(
  filter: CorporationListFilter = {},
  signal?: AbortSignal,
): Promise<CorporationList> {
  return authApiRequest("/api/corporations", {
    method: "get",
    query: {
      q: filter.q?.trim() || undefined,
      category: filter.category,
      status: filter.status,
      usage_status: filter.usage_status,
    },
    signal,
    parse: (data) => parseZodResponse(corporationListSchema, data),
  });
}

/** 新しい企業（法人・個人開設者）を登録する。 */
export function createCorporation(input: {
  category: CorporationCategory;
  name: string;
  representative_name: string;
  corporate_number?: string | null;
  address?: string;
  valid_from?: string | null;
  valid_to?: string | null;
  evidence?: string | null;
  usage_status?: CorporationUsageStatus;
}): Promise<Corporation> {
  return authApiRequest("/api/corporations", {
    method: "post",
    body: input,
    parse: (data) => parseZodResponse(corporationSchema, data),
  });
}

/** 指定 ID の企業（法人・個人開設者）の基本情報を更新する。 */
export function updateCorporation(
  corporationId: string,
  input: {
    name?: string | null;
    representative_name?: string | null;
    corporate_number?: string | null;
    address?: string | null;
    valid_from?: string | null;
    valid_to?: string | null;
    evidence?: string | null;
  },
): Promise<Corporation> {
  return authApiRequest("/api/corporations/{corporation_id}", {
    method: "patch",
    params: { corporation_id: corporationId },
    body: input,
    parse: (data) => parseZodResponse(corporationSchema, data),
  });
}

/** 指定 ID の企業（法人・個人開設者）の指定時点スナップショットを取得する。 */
export function fetchCorporationAt(
  corporationId: string,
  params: { as_of?: string; recorded_as_of?: string } = {},
  signal?: AbortSignal,
): Promise<Corporation> {
  return authApiRequest("/api/corporations/{corporation_id}", {
    method: "get",
    params: { corporation_id: corporationId },
    query: {
      as_of: params.as_of || undefined,
      recorded_as_of: params.recorded_as_of || undefined,
    },
    signal,
    parse: (data) => parseZodResponse(corporationSchema, data),
  });
}

/** 指定 ID の企業（法人・個人開設者）の変更履歴一覧を取得する。 */
export function fetchCorporationHistory(
  corporationId: string,
  signal?: AbortSignal,
): Promise<CorporationHistoryRecord[]> {
  return authApiRequest("/api/corporations/{corporation_id}/history", {
    method: "get",
    params: { corporation_id: corporationId },
    signal,
    parse: (data) => parseZodResponse(corporationHistoryListSchema, data),
  });
}

/** 指定 ID の企業の存続状態を変更（解散・吸収合併）する。 */
export function changeCorporationStatus(
  corporationId: string,
  input: {
    status: "dissolved" | "merged_out";
    effective_date?: string | null;
    surviving_corporation_id?: string | null;
    evidence?: string | null;
  },
): Promise<Corporation> {
  if (input.status === "merged_out") {
    return authApiRequest("/api/corporations/{corporation_id}/merge", {
      method: "post",
      params: { corporation_id: corporationId },
      body: {
        surviving_corporation_id: input.surviving_corporation_id ?? "",
        effective_date: input.effective_date || formatBusinessDateInTokyo(),
        evidence: input.evidence ?? "",
      },
      parse: (data) => parseZodResponse(corporationSchema, data),
    });
  }
  return authApiRequest("/api/corporations/{corporation_id}/status", {
    method: "patch",
    params: { corporation_id: corporationId },
    body: {
      status: "dissolved",
      effective_date: input.effective_date ?? undefined,
      evidence: input.evidence ?? undefined,
    },
    parse: (data) => parseZodResponse(corporationSchema, data),
  });
}

/** 指定 ID の企業のシステム利用状態を変更する。 */
export function changeCorporationUsageStatus(
  corporationId: string,
  usageStatus: CorporationUsageStatus,
): Promise<Corporation> {
  return authApiRequest("/api/corporations/{corporation_id}/usage-status", {
    method: "patch",
    params: { corporation_id: corporationId },
    body: { usage_status: usageStatus },
    parse: (data) => parseZodResponse(corporationSchema, data),
  });
}

/** 指定 ID の企業の過去履歴を訂正する。 */
export function correctCorporationHistory(
  corporationId: string,
  input: {
    as_of: string;
    name?: string | null;
    representative_name?: string | null;
    corporate_number?: string | null;
    address?: string | null;
    valid_from?: string | null;
    valid_to?: string | null;
    evidence: string;
  },
): Promise<CorporationHistoryRecord> {
  return authApiRequest("/api/corporations/{corporation_id}/history", {
    method: "patch",
    params: { corporation_id: corporationId },
    body: input,
    parse: (data) => parseZodResponse(corporationHistoryRecordSchema, data),
  });
}
