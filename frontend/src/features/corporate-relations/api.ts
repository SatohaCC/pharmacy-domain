import { authApiRequest } from "@/features/auth/api";
import { parseZodResponse } from "@/shared/lib/api/zodResponse";
import {
  type ConfirmationStatus,
  type CorporateRelation,
  type CorporateRelationList,
  type CorporateRelationListFilter,
  type CorporateRelationRevision,
  corporateRelationListSchema,
  corporateRelationRevisionListSchema,
  corporateRelationSchema,
  type RelationType,
} from "./schemas";

/** 条件に一致する法人間関係一覧を取得する。 */
export function fetchCorporateRelations(
  filter: CorporateRelationListFilter = {},
  signal?: AbortSignal,
): Promise<CorporateRelationList> {
  return authApiRequest("/api/corporate-relations", {
    method: "get",
    query: {
      corporation_id: filter.corporation_id || undefined,
      as_of: filter.as_of || undefined,
      relation_type: filter.relation_type,
      confirmation_status: filter.confirmation_status,
    },
    signal,
    parse: (data) => parseZodResponse(corporateRelationListSchema, data),
  });
}

/** 法人間関係を新規登録する。 */
export function registerCorporateRelation(input: {
  source_corporation_id: string;
  target_corporation_id: string;
  relation_type: RelationType;
  valid_from: string;
  valid_to?: string | null;
  evidence: string;
  confirmation_status?: ConfirmationStatus;
}): Promise<CorporateRelation> {
  return authApiRequest("/api/corporate-relations", {
    method: "post",
    body: input,
    parse: (data) => parseZodResponse(corporateRelationSchema, data),
  });
}

/** 法人間関係の訂正記録を追加する。 */
export function correctCorporateRelation(
  relationId: string,
  input: {
    valid_from?: string;
    valid_to?: string | null;
    evidence?: string;
    confirmation_status?: ConfirmationStatus;
  },
): Promise<CorporateRelation> {
  return authApiRequest("/api/corporate-relations/{relation_id}", {
    method: "patch",
    params: { relation_id: relationId },
    body: input,
    parse: (data) => parseZodResponse(corporateRelationSchema, data),
  });
}

/** 法人間関係を有効終了日で終了する。 */
export function endCorporateRelation(
  relationId: string,
  validTo: string,
): Promise<CorporateRelation> {
  return authApiRequest("/api/corporate-relations/{relation_id}/end", {
    method: "post",
    params: { relation_id: relationId },
    body: { valid_to: validTo },
    parse: (data) => parseZodResponse(corporateRelationSchema, data),
  });
}

/** 法人間関係の改訂履歴を取得する。 */
export function fetchCorporateRelationHistory(
  relationId: string,
  signal?: AbortSignal,
): Promise<CorporateRelationRevision[]> {
  return authApiRequest("/api/corporate-relations/{relation_id}/history", {
    method: "get",
    params: { relation_id: relationId },
    signal,
    parse: (data) => parseZodResponse(corporateRelationRevisionListSchema, data),
  });
}
