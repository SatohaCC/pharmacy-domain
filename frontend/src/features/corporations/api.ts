import { authApiRequest } from "@/features/auth/api";
import { parseZodResponse } from "@/shared/lib/api/zodResponse";
import {
  type Corporation,
  type CorporationCategory,
  type CorporationList,
  type CorporationListFilter,
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
    },
    signal,
    parse: (data) => parseZodResponse(corporationListSchema, data),
  });
}

/** 新しい企業（法人・個人開設者）を登録する。 */
export function createCorporation(input: {
  category: CorporationCategory;
  name: string;
  corporate_number?: string | null;
  address?: string;
  valid_from?: string | null;
  valid_to?: string | null;
  evidence?: string | null;
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
