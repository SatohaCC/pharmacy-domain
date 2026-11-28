"use client";

import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { Badge } from "@/shared/ui/badge/Badge";
import { Button } from "@/shared/ui/button/Button";
import { CorporateRelationActionPanels } from "./CorporateRelationActionPanels";
import { corporateRelationTreeViewStyles as s } from "./CorporateRelationTreeView.styles";
import {
  hierarchyRoleLabel,
  relationPeriodStatusLabel,
  relationRoleLabels,
  relationTypeLabel,
} from "./relationPresentation";
import type { CorporateRelationGraph, ParentChildTreeNode } from "./relationTree";
import type { CorporateRelation, CorporateRelationRevision } from "./schemas";

export interface CorporateRelationTreeViewProps {
  graph: CorporateRelationGraph;
  editingRelationId: string | null;
  editValidFrom: string;
  onEditValidFromChange: (value: string) => void;
  editValidTo: string;
  onEditValidToChange: (value: string) => void;
  editEvidence: string;
  onEditEvidenceChange: (value: string) => void;
  isCorrecting: boolean;
  correctErrorMessage: string | null;
  onOpenEdit: (rel: CorporateRelation) => void;
  onCloseEdit: () => void;
  onSubmitCorrect: (event: React.FormEvent<HTMLFormElement>, rel: CorporateRelation) => void;
  endingRelationId: string | null;
  endValidTo: string;
  onEndValidToChange: (value: string) => void;
  isEnding: boolean;
  endErrorMessage: string | null;
  onToggleEnd: (rel: CorporateRelation) => void;
  onSubmitEnd: (event: React.FormEvent<HTMLFormElement>, relId: string) => void;
  selectedHistoryRelationId: string | null;
  onSelectHistoryRelation: (relationId: string | null) => void;
  revisions: readonly CorporateRelationRevision[];
  isLoadingRevisions: boolean;
  revisionsErrorMessage: string | null;
}

function roleBadgeStyleForDepth(depth: number) {
  if (depth <= 0) return s.roleParentBadge;
  if (depth === 1) return s.roleChildBadge;
  return s.roleGrandchildBadge;
}

/** 親子関係を中心とした階層ツリーと、関連会社・FC/VC 契約の関係図ビュー。 */
export function CorporateRelationTreeView({
  graph,
  editingRelationId,
  editValidFrom,
  onEditValidFromChange,
  editValidTo,
  onEditValidToChange,
  editEvidence,
  onEditEvidenceChange,
  isCorrecting,
  correctErrorMessage,
  onOpenEdit,
  onCloseEdit,
  onSubmitCorrect,
  endingRelationId,
  endValidTo,
  onEndValidToChange,
  isEnding,
  endErrorMessage,
  onToggleEnd,
  onSubmitEnd,
  selectedHistoryRelationId,
  onSelectHistoryRelation,
  revisions,
  isLoadingRevisions,
  revisionsErrorMessage,
}: CorporateRelationTreeViewProps) {
  const [collapsedKeys, setCollapsedKeys] = useState<ReadonlySet<string>>(() => new Set());

  const hasCollapsible = graph.collapsibleNodeKeys.length > 0;
  const isAllCollapsed =
    hasCollapsible && graph.collapsibleNodeKeys.every((key) => collapsedKeys.has(key));
  const isAllExpanded =
    !hasCollapsible || graph.collapsibleNodeKeys.every((key) => !collapsedKeys.has(key));

  function toggleCollapse(key: string) {
    setCollapsedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function renderRelationActions(rel: CorporateRelation, labelId: string) {
    const isEditing = editingRelationId === rel.id;
    const isEndingThis = endingRelationId === rel.id;
    const isHistoryOpen = selectedHistoryRelationId === rel.id;

    return (
      <>
        <div {...stylex.props(s.nodeActions)}>
          <Button
            variant={isHistoryOpen ? "tonal" : "outlined"}
            size="sm"
            aria-describedby={labelId}
            onClick={() => onSelectHistoryRelation(isHistoryOpen ? null : rel.id)}
          >
            {isHistoryOpen ? "改訂履歴を閉じる" : "改訂履歴"}
          </Button>
          <Button
            variant={isEditing ? "tonal" : "outlined"}
            size="sm"
            aria-describedby={labelId}
            onClick={() => (isEditing ? onCloseEdit() : onOpenEdit(rel))}
          >
            {isEditing ? "訂正を閉じる" : "訂正"}
          </Button>
          <Button
            variant={isEndingThis ? "tonal" : "outlined"}
            size="sm"
            aria-describedby={labelId}
            onClick={() => onToggleEnd(rel)}
          >
            {isEndingThis ? "終了を閉じる" : "関係を終了"}
          </Button>
        </div>
        <CorporateRelationActionPanels
          relation={rel}
          isEditing={isEditing}
          editValidFrom={editValidFrom}
          onEditValidFromChange={onEditValidFromChange}
          editValidTo={editValidTo}
          onEditValidToChange={onEditValidToChange}
          editEvidence={editEvidence}
          onEditEvidenceChange={onEditEvidenceChange}
          isCorrecting={isCorrecting}
          correctErrorMessage={correctErrorMessage}
          onSubmitCorrect={onSubmitCorrect}
          isEndingThis={isEndingThis}
          endValidTo={endValidTo}
          onEndValidToChange={onEndValidToChange}
          isEnding={isEnding}
          endErrorMessage={endErrorMessage}
          onSubmitEnd={onSubmitEnd}
          isHistoryOpen={isHistoryOpen}
          revisions={revisions}
          isLoadingRevisions={isLoadingRevisions}
          revisionsErrorMessage={revisionsErrorMessage}
        />
      </>
    );
  }

  function renderTreeNode(node: ParentChildTreeNode) {
    const hasChildren = node.children.length > 0;
    const isCollapsed = collapsedKeys.has(node.key);
    const rel = node.incomingRelation;
    const isEnded = node.incomingPeriodStatus === "ended";
    const summaryLabelId = `tree-node-summary-${node.key.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

    return (
      <div {...stylex.props(s.nodeStack)}>
        <div
          {...stylex.props(
            s.nodeCard,
            node.depth === 0 && s.nodeCardRoot,
            isEnded && s.nodeCardEnded,
            node.isFocusCorporation && s.nodeCardFocused,
          )}
        >
          <div {...stylex.props(s.nodeHeader)}>
            <div {...stylex.props(s.nodeIdentity)}>
              <div {...stylex.props(s.nodeTitleRow)}>
                <span {...stylex.props(s.legendChip, roleBadgeStyleForDepth(node.depth))}>
                  {hierarchyRoleLabel(node.depth)}
                </span>
                <p id={summaryLabelId} {...stylex.props(s.corpName)}>
                  {node.corporationName}
                </p>
                {node.corporationCategory ? (
                  <Badge tone="neutral">
                    {node.corporationCategory === "corporation" ? "法人" : "個人開設者"}
                  </Badge>
                ) : null}
                {node.isFocusCorporation ? <Badge tone="success">対象法人</Badge> : null}
                {node.incomingPeriodStatus && node.incomingPeriodStatus !== "active" ? (
                  <Badge tone="neutral">
                    {relationPeriodStatusLabel(node.incomingPeriodStatus)}
                  </Badge>
                ) : null}
                {node.hasCycleReference ? <Badge tone="danger">循環参照を省略</Badge> : null}
              </div>

              {rel && node.parentCorporationName ? (
                <p {...stylex.props(s.relationLine)}>
                  <span>親: {node.parentCorporationName}</span>
                  <span aria-hidden="true" {...stylex.props(s.arrowGlyph)}>
                    →
                  </span>
                  <span>
                    {hierarchyRoleLabel(node.depth)}: {node.corporationName}
                  </span>
                </p>
              ) : (
                <p {...stylex.props(s.relationLine)}>
                  <span>最上位の親法人（傘下 {node.descendantCount} 法人）</span>
                </p>
              )}

              {rel ? (
                <p {...stylex.props(s.metaRow)}>
                  <span>
                    有効期間: {rel.valid_from} 〜 {rel.valid_to ?? "終了未定"}
                  </span>
                  <span>根拠: {rel.evidence}</span>
                </p>
              ) : null}
            </div>

            {hasChildren ? (
              <button
                type="button"
                aria-expanded={!isCollapsed}
                onClick={() => toggleCollapse(node.key)}
                {...stylex.props(s.toggleButton)}
              >
                {isCollapsed
                  ? `配下を表示（${node.children.length}件）`
                  : `配下を折りたたむ（${node.children.length}件）`}
              </button>
            ) : null}
          </div>

          {node.sideLinks.length > 0 ? (
            <div {...stylex.props(s.sideLinksBox)}>
              <p {...stylex.props(s.sideLinksHeading)}>関連会社・FC / VC 契約のつながり</p>
              <ul {...stylex.props(s.sideLinksList)}>
                {node.sideLinks.map((link) => (
                  <li key={`${node.key}-${link.relation.id}`} {...stylex.props(s.sideLinkChip)}>
                    <Badge tone="neutral">{relationTypeLabel(link.relation.relation_type)}</Badge>
                    <span>
                      自法人: {link.selfRoleLabel}{" "}
                      <span aria-hidden="true" {...stylex.props(s.arrowGlyph)}>
                        {link.direction === "outgoing" ? "→" : "←"}
                      </span>{" "}
                      {link.partnerRoleLabel}: {link.partnerCorporationName}
                    </span>
                    {link.periodStatus !== "active" ? (
                      <Badge tone="neutral">{relationPeriodStatusLabel(link.periodStatus)}</Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {rel ? renderRelationActions(rel, summaryLabelId) : null}
        </div>

        {hasChildren && !isCollapsed ? (
          <ul {...stylex.props(s.childList)}>
            {node.children.map((child) => (
              <li key={child.key} {...stylex.props(s.childListItem)}>
                <span aria-hidden="true" {...stylex.props(s.connectorArm)} />
                {renderTreeNode(child)}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <div {...stylex.props(s.root)}>
      <div {...stylex.props(s.toolbar)}>
        <div {...stylex.props(s.legendRow)}>
          <span {...stylex.props(s.legendLabel)}>凡例:</span>
          <span {...stylex.props(s.legendChip, s.roleParentBadge)}>親法人</span>
          <span {...stylex.props(s.legendChip, s.roleChildBadge)}>子法人</span>
          <span {...stylex.props(s.legendChip, s.roleGrandchildBadge)}>孫法人</span>
          <span {...stylex.props(s.legendChip, s.roleOtherBadge)}>関連会社・FC/VC</span>
          <span {...stylex.props(s.legendChip, s.roleEndedBadge)}>終了済み</span>
        </div>

        {hasCollapsible ? (
          <div {...stylex.props(s.toolbarActions)}>
            <Button
              variant="outlined"
              size="sm"
              disabled={isAllExpanded}
              onClick={() => setCollapsedKeys(new Set())}
            >
              すべて展開
            </Button>
            <Button
              variant="outlined"
              size="sm"
              disabled={isAllCollapsed}
              onClick={() => setCollapsedKeys(new Set(graph.collapsibleNodeKeys))}
            >
              すべて折りたたむ
            </Button>
          </div>
        ) : null}
      </div>

      <section aria-labelledby="hierarchy-tree-heading" {...stylex.props(s.sectionBlock)}>
        <div {...stylex.props(s.sectionHeadingRow)}>
          <h3 id="hierarchy-tree-heading" {...stylex.props(s.sectionHeading)}>
            親子関係の階層ツリー（{graph.parentChildCount}件）
          </h3>
          <p {...stylex.props(s.sectionSubText)}>
            親法人から子法人・孫法人への支配関係を階層と枝線で表示しています。
          </p>
        </div>

        {graph.hierarchyRoots.length === 0 ? (
          <p {...stylex.props(s.emptyNotice)}>
            表示対象の親子関係はありません。関連会社・FC / VC 契約は下のセクションで確認できます。
          </p>
        ) : (
          <ul {...stylex.props(s.treeGroupList)}>
            {graph.hierarchyRoots.map((rootNode) => (
              <li key={rootNode.key} {...stylex.props(s.treeGroupItem)}>
                {renderTreeNode(rootNode)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="other-relations-heading" {...stylex.props(s.sectionBlock)}>
        <div {...stylex.props(s.sectionHeadingRow)}>
          <h3 id="other-relations-heading" {...stylex.props(s.sectionHeading)}>
            関連会社・FC / VC 契約（{graph.otherRelationCount}件）
          </h3>
          <p {...stylex.props(s.sectionSubText)}>
            資本提携（関連元 → 関連先）やフランチャイズ契約（本部 → 加盟店）の方向と操作を行えます。
          </p>
        </div>

        {graph.otherRelations.length === 0 ? (
          <p {...stylex.props(s.emptyNotice)}>表示対象の関連会社・FC / VC 契約はありません。</p>
        ) : (
          <ul {...stylex.props(s.otherList)}>
            {graph.otherRelations.map((item) => {
              const roles = relationRoleLabels(item.relation.relation_type);
              const summaryId = `other-relation-summary-${item.relation.id}`;

              return (
                <li key={item.relation.id} {...stylex.props(s.otherCard)}>
                  <div {...stylex.props(s.otherCardHeader)}>
                    <div {...stylex.props(s.nodeIdentity)}>
                      <div {...stylex.props(s.nodeTitleRow)}>
                        <Badge tone="neutral">
                          {relationTypeLabel(item.relation.relation_type)}
                        </Badge>
                        <Badge tone="neutral">{roles.connector}</Badge>
                        {item.periodStatus !== "active" ? (
                          <Badge tone="neutral">
                            {relationPeriodStatusLabel(item.periodStatus)}
                          </Badge>
                        ) : null}
                      </div>
                      <p id={summaryId} {...stylex.props(s.otherFlowRow)}>
                        <span {...stylex.props(s.legendChip, s.roleParentBadge)}>
                          {roles.source}
                        </span>
                        <span>{item.sourceName}</span>
                        <span aria-hidden="true" {...stylex.props(s.arrowGlyph)}>
                          →
                        </span>
                        <span {...stylex.props(s.legendChip, s.roleChildBadge)}>
                          {roles.target}
                        </span>
                        <span>{item.targetName}</span>
                      </p>
                      <p {...stylex.props(s.metaRow)}>
                        <span>
                          有効期間: {item.relation.valid_from} 〜{" "}
                          {item.relation.valid_to ?? "終了未定"}
                        </span>
                        <span>根拠: {item.relation.evidence}</span>
                      </p>
                    </div>
                  </div>

                  {renderRelationActions(item.relation, summaryId)}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
