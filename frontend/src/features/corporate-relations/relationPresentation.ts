import type { CorporateRelation, RelationType } from "./schemas";

/** 基準日における法人間関係の有効期間状態。 */
export type RelationPeriodStatus = "active" | "upcoming" | "ended";

/** 関係種別ごとの役割ラベル組。 */
export interface RelationRoleLabels {
  source: string;
  target: string;
  connector: string;
}

/** 関係種別コードを表示用ラベルへ変換する。 */
export function relationTypeLabel(type: RelationType): string {
  switch (type) {
    case "parent_child":
      return "親子関係";
    case "affiliate":
      return "関連会社";
    case "fc_vc":
      return "FC / VC 契約";
  }
}

/** 関係種別ごとの関係元・関係先の役割ラベルを返す。 */
export function relationRoleLabels(type: RelationType): RelationRoleLabels {
  switch (type) {
    case "parent_child":
      return { source: "親法人", target: "子法人", connector: "親 → 子" };
    case "affiliate":
      return { source: "関連元", target: "関連先", connector: "関連元 → 関連先" };
    case "fc_vc":
      return { source: "本部", target: "加盟店", connector: "本部 → 加盟店" };
  }
}

/**
 * 半開区間 [valid_from, valid_to) の仕様に基づき、基準日時点の有効期間状態を判定する。
 * valid_to 当日は終了済みとして扱う。
 */
export function getRelationPeriodStatus(
  relation: Pick<CorporateRelation, "valid_from" | "valid_to">,
  referenceDate: string,
): RelationPeriodStatus {
  if (relation.valid_to !== null && relation.valid_to <= referenceDate) {
    return "ended";
  }
  if (relation.valid_from > referenceDate) {
    return "upcoming";
  }
  return "active";
}

/** 有効期間状態の表示用ラベルを返す。 */
export function relationPeriodStatusLabel(status: RelationPeriodStatus): string {
  switch (status) {
    case "active":
      return "有効中";
    case "upcoming":
      return "開始予定";
    case "ended":
      return "終了";
  }
}

/** 階層深さに応じた親子役割ラベルを返す。 */
export function hierarchyRoleLabel(depth: number): string {
  if (depth <= 0) {
    return "親法人";
  }
  if (depth === 1) {
    return "子法人";
  }
  if (depth === 2) {
    return "孫法人";
  }
  return `第${depth + 1}階層`;
}
