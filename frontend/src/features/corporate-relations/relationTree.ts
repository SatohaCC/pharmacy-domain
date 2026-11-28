import type { Corporation } from "@/features/corporations/schemas";
import {
  getRelationPeriodStatus,
  type RelationPeriodStatus,
  relationRoleLabels,
} from "./relationPresentation";
import type { CorporateRelation, RelationType } from "./schemas";

/** 親子階層上の法人に紐づく関連会社・FC/VC 契約の参照情報。 */
export interface RelatedNonHierarchyLink {
  relation: CorporateRelation;
  direction: "outgoing" | "incoming";
  selfRoleLabel: string;
  partnerRoleLabel: string;
  partnerCorporationId: string;
  partnerCorporationName: string;
  periodStatus: RelationPeriodStatus;
}

/** 親子関係階層ツリーの 1 ノード。 */
export interface ParentChildTreeNode {
  key: string;
  corporationId: string;
  corporationName: string;
  corporationCategory: Corporation["category"] | null;
  corporationStatus: Corporation["status"] | null;
  depth: number;
  incomingRelation: CorporateRelation | null;
  incomingPeriodStatus: RelationPeriodStatus | null;
  parentCorporationName: string | null;
  children: readonly ParentChildTreeNode[];
  descendantCount: number;
  sideLinks: readonly RelatedNonHierarchyLink[];
  isFocusCorporation: boolean;
  hasCycleReference: boolean;
}

/** 親子以外の関係（関連会社・FC/VC 契約）の表示項目。 */
export interface OtherRelationItem {
  relation: CorporateRelation;
  sourceName: string;
  targetName: string;
  periodStatus: RelationPeriodStatus;
}

/** 法人間関係管理画面で描画する関係グラフ全体。 */
export interface CorporateRelationGraph {
  hierarchyRoots: readonly ParentChildTreeNode[];
  otherRelations: readonly OtherRelationItem[];
  parentChildCount: number;
  otherRelationCount: number;
  collapsibleNodeKeys: readonly string[];
}

function compareTextJa(a: string, b: string): number {
  return a.localeCompare(b, "ja");
}

function relationTypeSortOrder(type: RelationType): number {
  switch (type) {
    case "fc_vc":
      return 0;
    case "affiliate":
      return 1;
    case "parent_child":
      return 2;
  }
}

function isEndedOrder(status: RelationPeriodStatus): number {
  return status === "ended" ? 1 : 0;
}

const parentExpansionPriority: Record<RelationPeriodStatus, number> = {
  active: 2,
  upcoming: 1,
  ended: 0,
};

/** 法人一覧と法人間関係一覧から、階層ツリーと関連会社・FC/VC 一覧を構築する。 */
export function buildCorporateRelationGraph(params: {
  corporations: readonly Corporation[];
  relations: readonly CorporateRelation[];
  referenceDate: string;
  focusCorporationId?: string;
}): CorporateRelationGraph {
  const { corporations, relations, referenceDate, focusCorporationId } = params;
  const corporationById = new Map(corporations.map((corp) => [corp.id, corp]));
  const getCorporationName = (corpId: string) => corporationById.get(corpId)?.name ?? corpId;

  const parentChildRelations: CorporateRelation[] = [];
  const otherRelationsRaw: CorporateRelation[] = [];

  for (const relation of relations) {
    if (relation.relation_type === "parent_child") {
      parentChildRelations.push(relation);
    } else {
      otherRelationsRaw.push(relation);
    }
  }

  // 関連会社・FC/VC 契約を両端の法人 ID へ紐づける。
  const sideLinksByCorpId = new Map<string, RelatedNonHierarchyLink[]>();
  const addSideLink = (corpId: string, link: RelatedNonHierarchyLink) => {
    const list = sideLinksByCorpId.get(corpId);
    if (list) {
      list.push(link);
    } else {
      sideLinksByCorpId.set(corpId, [link]);
    }
  };

  const otherRelations: OtherRelationItem[] = otherRelationsRaw.map((relation) => {
    const sourceName = getCorporationName(relation.source_corporation_id);
    const targetName = getCorporationName(relation.target_corporation_id);
    const periodStatus = getRelationPeriodStatus(relation, referenceDate);
    const roles = relationRoleLabels(relation.relation_type);

    addSideLink(relation.source_corporation_id, {
      relation,
      direction: "outgoing",
      selfRoleLabel: roles.source,
      partnerRoleLabel: roles.target,
      partnerCorporationId: relation.target_corporation_id,
      partnerCorporationName: targetName,
      periodStatus,
    });
    addSideLink(relation.target_corporation_id, {
      relation,
      direction: "incoming",
      selfRoleLabel: roles.target,
      partnerRoleLabel: roles.source,
      partnerCorporationId: relation.source_corporation_id,
      partnerCorporationName: sourceName,
      periodStatus,
    });

    return {
      relation,
      sourceName,
      targetName,
      periodStatus,
    };
  });

  for (const links of sideLinksByCorpId.values()) {
    links.sort((a, b) => {
      const endedDiff = isEndedOrder(a.periodStatus) - isEndedOrder(b.periodStatus);
      if (endedDiff !== 0) return endedDiff;
      const typeDiff =
        relationTypeSortOrder(a.relation.relation_type) -
        relationTypeSortOrder(b.relation.relation_type);
      if (typeDiff !== 0) return typeDiff;
      const nameDiff = compareTextJa(a.partnerCorporationName, b.partnerCorporationName);
      if (nameDiff !== 0) return nameDiff;
      const fromDiff = a.relation.valid_from.localeCompare(b.relation.valid_from);
      if (fromDiff !== 0) return fromDiff;
      return a.relation.id.localeCompare(b.relation.id);
    });
  }

  otherRelations.sort((a, b) => {
    const endedDiff = isEndedOrder(a.periodStatus) - isEndedOrder(b.periodStatus);
    if (endedDiff !== 0) return endedDiff;
    const typeDiff =
      relationTypeSortOrder(a.relation.relation_type) -
      relationTypeSortOrder(b.relation.relation_type);
    if (typeDiff !== 0) return typeDiff;
    const sourceDiff = compareTextJa(a.sourceName, b.sourceName);
    if (sourceDiff !== 0) return sourceDiff;
    const targetDiff = compareTextJa(a.targetName, b.targetName);
    if (targetDiff !== 0) return targetDiff;
    const fromDiff = a.relation.valid_from.localeCompare(b.relation.valid_from);
    if (fromDiff !== 0) return fromDiff;
    return a.relation.id.localeCompare(b.relation.id);
  });

  // 親子関係の有向グラフを構築する。
  const childrenByParent = new Map<string, CorporateRelation[]>();
  const allParentChildCorpIds = new Set<string>();
  const childCorpIds = new Set<string>();
  const highestParentPriorityByChild = new Map<string, number>();

  for (const relation of parentChildRelations) {
    allParentChildCorpIds.add(relation.source_corporation_id);
    allParentChildCorpIds.add(relation.target_corporation_id);
    childCorpIds.add(relation.target_corporation_id);
    const priority = parentExpansionPriority[getRelationPeriodStatus(relation, referenceDate)];
    const childId = relation.target_corporation_id;
    highestParentPriorityByChild.set(
      childId,
      Math.max(priority, highestParentPriorityByChild.get(childId) ?? priority),
    );

    const list = childrenByParent.get(relation.source_corporation_id);
    if (list) {
      list.push(relation);
    } else {
      childrenByParent.set(relation.source_corporation_id, [relation]);
    }
  }

  for (const childRelations of childrenByParent.values()) {
    childRelations.sort((a, b) => {
      const aEnded = isEndedOrder(getRelationPeriodStatus(a, referenceDate));
      const bEnded = isEndedOrder(getRelationPeriodStatus(b, referenceDate));
      if (aEnded !== bEnded) return aEnded - bEnded;
      const nameDiff = compareTextJa(
        getCorporationName(a.target_corporation_id),
        getCorporationName(b.target_corporation_id),
      );
      if (nameDiff !== 0) return nameDiff;
      const fromDiff = a.valid_from.localeCompare(b.valid_from);
      if (fromDiff !== 0) return fromDiff;
      return a.id.localeCompare(b.id);
    });
  }

  const visitedRelationIds = new Set<string>();
  const expandedSubtreeCorpIds = new Set<string>();
  const collapsibleNodeKeys: string[] = [];

  const createNode = (paramsForNode: {
    key: string;
    corporationId: string;
    depth: number;
    incomingRelation: CorporateRelation | null;
    incomingPeriodStatus: RelationPeriodStatus | null;
    parentCorporationName: string | null;
    ancestorCorporationIds: ReadonlySet<string>;
    suppressDescendantExpansion?: boolean;
  }): ParentChildTreeNode => {
    const {
      key,
      corporationId,
      depth,
      incomingRelation,
      incomingPeriodStatus,
      parentCorporationName,
      ancestorCorporationIds,
      suppressDescendantExpansion = false,
    } = paramsForNode;
    const corporation = corporationById.get(corporationId);
    const corporationName = corporation?.name ?? corporationId;
    const nextAncestors = new Set(ancestorCorporationIds);
    nextAncestors.add(corporationId);

    const children: ParentChildTreeNode[] = [];
    if (!suppressDescendantExpansion) {
      expandedSubtreeCorpIds.add(corporationId);
      const outgoing = childrenByParent.get(corporationId) ?? [];
      for (const childRel of outgoing) {
        visitedRelationIds.add(childRel.id);
        const childStatus = getRelationPeriodStatus(childRel, referenceDate);
        const childCorpId = childRel.target_corporation_id;
        const isCycle = nextAncestors.has(childCorpId);
        const priority = parentExpansionPriority[childStatus];
        // 法人名の表示順にかかわらず、有効中・開始予定・終了の順で子孫を展開する枝を優先する。
        const shouldSuppressSubtree =
          isCycle ||
          expandedSubtreeCorpIds.has(childCorpId) ||
          priority < (highestParentPriorityByChild.get(childCorpId) ?? priority);

        children.push(
          createNode({
            key: `edge:${childRel.id}`,
            corporationId: childCorpId,
            depth: depth + 1,
            incomingRelation: childRel,
            incomingPeriodStatus: childStatus,
            parentCorporationName: corporationName,
            ancestorCorporationIds: nextAncestors,
            suppressDescendantExpansion: shouldSuppressSubtree,
          }),
        );
      }
    }

    if (children.length > 0) {
      collapsibleNodeKeys.push(key);
    }

    const descendantCount = children.reduce((sum, child) => sum + 1 + child.descendantCount, 0);

    return {
      key,
      corporationId,
      corporationName,
      corporationCategory: corporation?.category ?? null,
      corporationStatus: corporation?.status ?? null,
      depth,
      incomingRelation,
      incomingPeriodStatus,
      parentCorporationName,
      children,
      descendantCount,
      sideLinks: sideLinksByCorpId.get(corporationId) ?? [],
      isFocusCorporation: Boolean(focusCorporationId && focusCorporationId === corporationId),
      hasCycleReference: Boolean(
        incomingRelation && ancestorCorporationIds.has(incomingRelation.target_corporation_id),
      ),
    };
  };

  const rootCandidateIds = Array.from(allParentChildCorpIds)
    .filter((corpId) => !childCorpIds.has(corpId))
    .sort((a, b) => {
      const nameDiff = compareTextJa(getCorporationName(a), getCorporationName(b));
      return nameDiff !== 0 ? nameDiff : a.localeCompare(b);
    });

  const hierarchyRoots: ParentChildTreeNode[] = rootCandidateIds.map((rootCorpId) =>
    createNode({
      key: `root:${rootCorpId}`,
      corporationId: rootCorpId,
      depth: 0,
      incomingRelation: null,
      incomingPeriodStatus: null,
      parentCorporationName: null,
      ancestorCorporationIds: new Set(),
    }),
  );

  // 時間軸をまたぐ閉路等でルート候補が欠けた連結成分がある場合も、未到達エッジからフォールバックルートを補う。
  while (visitedRelationIds.size < parentChildRelations.length) {
    const remainingSources = Array.from(
      new Set(
        parentChildRelations
          .filter((rel) => !visitedRelationIds.has(rel.id))
          .map((rel) => rel.source_corporation_id),
      ),
    ).sort((a, b) => {
      // 期間をまたぐ閉路でも、現行階層の起点から展開する。
      const activeParentDiff =
        Number(highestParentPriorityByChild.get(a) === parentExpansionPriority.active) -
        Number(highestParentPriorityByChild.get(b) === parentExpansionPriority.active);
      if (activeParentDiff !== 0) return activeParentDiff;
      const nameDiff = compareTextJa(getCorporationName(a), getCorporationName(b));
      return nameDiff !== 0 ? nameDiff : a.localeCompare(b);
    });
    const fallbackRootId = remainingSources[0];
    if (!fallbackRootId) break;
    hierarchyRoots.push(
      createNode({
        key: `root:${fallbackRootId}`,
        corporationId: fallbackRootId,
        depth: 0,
        incomingRelation: null,
        incomingPeriodStatus: null,
        parentCorporationName: null,
        ancestorCorporationIds: new Set(),
      }),
    );
  }

  return {
    hierarchyRoots,
    otherRelations,
    parentChildCount: parentChildRelations.length,
    otherRelationCount: otherRelations.length,
    collapsibleNodeKeys,
  };
}
