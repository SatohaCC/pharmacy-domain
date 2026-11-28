"use client";

import * as stylex from "@stylexjs/stylex";
import Link from "next/link";
import { Fragment, useState } from "react";
import type { AuthUser } from "@/features/auth/schemas";
import { VendorConsoleHeader } from "@/features/auth/VendorConsoleHeader";
import { vendorConsoleLayoutStyles as layout } from "@/features/auth/VendorConsoleLayout.styles";
import { formatCorporationOptionLabel } from "@/features/corporations/formatCorporationLabel";
import type { Corporation } from "@/features/corporations/schemas";
import { formatBusinessDateInTokyo } from "@/shared/lib/date/businessDate";
import { Alert } from "@/shared/ui/alert/Alert";
import { Badge } from "@/shared/ui/badge/Badge";
import { Button } from "@/shared/ui/button/Button";
import { Select, type SelectOption } from "@/shared/ui/select/Select";
import { Spinner } from "@/shared/ui/spinner/Spinner";
import { type TabItem, Tabs } from "@/shared/ui/tabs/Tabs";
import { TextField } from "@/shared/ui/text-field/TextField";
import { CorporateRelationActionPanels } from "./CorporateRelationActionPanels";
import { corporateRelationsWorkspaceStyles as s } from "./CorporateRelationsWorkspace.styles";
import { CorporateRelationTreeView } from "./CorporateRelationTreeView";
import {
  getRelationPeriodStatus,
  relationPeriodStatusLabel,
  relationRoleLabels,
  relationTypeLabel,
} from "./relationPresentation";
import { buildCorporateRelationGraph } from "./relationTree";
import type {
  CorporateRelation,
  CorporateRelationListFilter,
  CorporateRelationRevision,
} from "./schemas";

const RELATION_TYPE_OPTIONS: readonly SelectOption[] = [
  { value: "parent_child", label: "親子関係" },
  { value: "affiliate", label: "関連会社" },
  { value: "fc_vc", label: "FC / VC 契約" },
];

const RELATION_TYPE_FILTER_OPTIONS: readonly SelectOption[] = [
  { value: "all", label: "すべての関係種別" },
  ...RELATION_TYPE_OPTIONS,
];

export interface CorporateRelationsWorkspaceProps {
  currentUser: AuthUser;
  corporations: readonly Corporation[];
  relations: readonly CorporateRelation[];
  totalCount: number;
  filter: CorporateRelationListFilter;
  onFilterChange: (next: CorporateRelationListFilter) => void;
  isLoadingRelations: boolean;
  relationsErrorMessage: string | null;
  notice?: "created" | null;
  onDismissNotice?: () => void;
  isCorrecting: boolean;
  correctErrorMessage: string | null;
  onCorrectRelation: (
    relationId: string,
    input: {
      valid_from?: string;
      valid_to?: string | null;
      evidence?: string;
    },
  ) => Promise<boolean>;
  isEnding: boolean;
  endErrorMessage: string | null;
  onEndRelation: (relationId: string, validTo: string) => Promise<boolean>;
  selectedHistoryRelationId: string | null;
  onSelectHistoryRelation: (relationId: string | null) => void;
  revisions: readonly CorporateRelationRevision[];
  isLoadingRevisions: boolean;
  revisionsErrorMessage: string | null;
  isLoggingOut: boolean;
  onLogout: () => void;
  today?: string;
}

/** 法人間関係の検索・関係図・一覧・訂正・終了・改訂履歴管理ワークスペース。 */
export function CorporateRelationsWorkspace({
  currentUser,
  corporations,
  relations,
  totalCount,
  filter,
  onFilterChange,
  isLoadingRelations,
  relationsErrorMessage,
  notice = null,
  onDismissNotice,
  isCorrecting,
  correctErrorMessage,
  onCorrectRelation,
  isEnding,
  endErrorMessage,
  onEndRelation,
  selectedHistoryRelationId,
  onSelectHistoryRelation,
  revisions,
  isLoadingRevisions,
  revisionsErrorMessage,
  isLoggingOut,
  onLogout,
  today,
}: CorporateRelationsWorkspaceProps) {
  const [viewMode, setViewMode] = useState<"tree" | "table">("tree");
  const [editingRelationId, setEditingRelationId] = useState<string | null>(null);
  const [editValidFrom, setEditValidFrom] = useState("");
  const [editValidTo, setEditValidTo] = useState("");
  const [editEvidence, setEditEvidence] = useState("");

  const [endingRelationId, setEndingRelationId] = useState<string | null>(null);
  const [endValidTo, setEndValidTo] = useState("");

  const corporationNameById = new Map(corporations.map((corp) => [corp.id, corp.name]));
  const corpFilterOptions: readonly SelectOption[] = [
    { value: "all", label: "すべての法人" },
    ...corporations.map((corp) => ({
      value: corp.id,
      label: formatCorporationOptionLabel(corp),
    })),
  ];

  const referenceDate = filter.as_of ?? today ?? formatBusinessDateInTokyo();
  const graph = buildCorporateRelationGraph({
    corporations,
    relations,
    referenceDate,
    focusCorporationId: filter.corporation_id,
  });

  function openEditPanel(rel: CorporateRelation) {
    setEndingRelationId(null);
    setEditingRelationId(rel.id);
    setEditValidFrom(rel.valid_from);
    setEditValidTo(rel.valid_to ?? "");
    setEditEvidence(rel.evidence);
  }

  function toggleEndPanel(rel: CorporateRelation) {
    const isEndingThis = endingRelationId === rel.id;
    if (!isEndingThis) {
      setEditingRelationId(null);
    }
    setEndingRelationId(isEndingThis ? null : rel.id);
    setEndValidTo("");
  }

  async function handleCorrectSubmit(
    event: React.FormEvent<HTMLFormElement>,
    rel: CorporateRelation,
  ) {
    event.preventDefault();
    const payload: {
      valid_from?: string;
      valid_to?: string | null;
      evidence?: string;
    } = {};
    const trimmedFrom = editValidFrom.trim();
    const nextValidTo = editValidTo.trim() || null;
    const trimmedEvidence = editEvidence.trim();

    if (trimmedFrom && trimmedFrom !== rel.valid_from) {
      payload.valid_from = trimmedFrom;
    }
    if (nextValidTo !== rel.valid_to) {
      payload.valid_to = nextValidTo;
    }
    if (trimmedEvidence && trimmedEvidence !== rel.evidence) {
      payload.evidence = trimmedEvidence;
    }

    const ok = await onCorrectRelation(rel.id, payload);
    if (ok) {
      setEditingRelationId(null);
    }
  }

  async function handleEndSubmit(event: React.FormEvent<HTMLFormElement>, relId: string) {
    event.preventDefault();
    if (!endValidTo.trim()) {
      return;
    }
    const ok = await onEndRelation(relId, endValidTo.trim());
    if (ok) {
      setEndingRelationId(null);
      setEndValidTo("");
      if (editingRelationId === relId) {
        setEditingRelationId(null);
      }
    }
  }

  const tableContent = (
    <section aria-label="法人間関係一覧テーブル" {...stylex.props(s.tableWrapper)}>
      <table {...stylex.props(s.table)}>
        <caption {...stylex.props(s.visuallyHidden)}>法人間関係一覧</caption>
        <thead {...stylex.props(s.tableHead)}>
          <tr>
            <th scope="col" {...stylex.props(s.tableHeadCell)}>
              関係元（親・本部）
            </th>
            <th scope="col" {...stylex.props(s.tableHeadCell)}>
              関係先（子・加盟店）
            </th>
            <th scope="col" {...stylex.props(s.tableHeadCell)}>
              関係種別
            </th>
            <th scope="col" {...stylex.props(s.tableHeadCell)}>
              有効期間
            </th>
            <th scope="col" {...stylex.props(s.tableHeadCell)}>
              根拠
            </th>
            <th scope="col" {...stylex.props(s.tableHeadCell)}>
              操作
            </th>
          </tr>
        </thead>
        <tbody {...stylex.props(s.tableBody)}>
          {relations.map((rel) => {
            const sourceName =
              corporationNameById.get(rel.source_corporation_id) ?? rel.source_corporation_id;
            const targetName =
              corporationNameById.get(rel.target_corporation_id) ?? rel.target_corporation_id;
            const roles = relationRoleLabels(rel.relation_type);
            const periodStatus = getRelationPeriodStatus(rel, referenceDate);
            const isEditing = editingRelationId === rel.id;
            const isEndingThis = endingRelationId === rel.id;
            const isHistoryOpen = selectedHistoryRelationId === rel.id;

            return (
              <Fragment key={rel.id}>
                <tr {...stylex.props(s.tableRow)}>
                  <th scope="row" {...stylex.props(s.tableRowHeader)}>
                    <div {...stylex.props(s.cellRoleRow)}>
                      <span {...stylex.props(s.roleTagSource)}>{roles.source}</span>
                      <span>{sourceName}</span>
                    </div>
                  </th>
                  <td {...stylex.props(s.tableCell)}>
                    <span {...stylex.props(s.mobileCellLabel)}>関係先（子・加盟店）:</span>
                    <div {...stylex.props(s.cellRoleRow)}>
                      <span {...stylex.props(s.roleTagTarget)}>{roles.target}</span>
                      <span>{targetName}</span>
                    </div>
                  </td>
                  <td {...stylex.props(s.tableCell)}>
                    <span {...stylex.props(s.mobileCellLabel)}>種別:</span>
                    <Badge tone="neutral">{relationTypeLabel(rel.relation_type)}</Badge>
                  </td>
                  <td {...stylex.props(s.tableCell)}>
                    <span {...stylex.props(s.mobileCellLabel)}>有効期間:</span>
                    <div {...stylex.props(s.periodMetaRow)}>
                      <span>
                        {rel.valid_from} 〜 {rel.valid_to ?? "終了未定"}
                      </span>
                      {periodStatus !== "active" ? (
                        <Badge tone="neutral">{relationPeriodStatusLabel(periodStatus)}</Badge>
                      ) : null}
                    </div>
                  </td>
                  <td {...stylex.props(s.tableCell)}>
                    <span {...stylex.props(s.mobileCellLabel)}>根拠:</span>
                    <span>{rel.evidence}</span>
                  </td>
                  <td {...stylex.props(s.tableCell)}>
                    <div {...stylex.props(s.actionRow)}>
                      <Button
                        variant={isHistoryOpen ? "tonal" : "outlined"}
                        size="sm"
                        onClick={() => onSelectHistoryRelation(isHistoryOpen ? null : rel.id)}
                      >
                        {isHistoryOpen ? "改訂履歴を閉じる" : "改訂履歴"}
                      </Button>
                      <Button
                        variant={isEditing ? "tonal" : "outlined"}
                        size="sm"
                        onClick={() =>
                          isEditing ? setEditingRelationId(null) : openEditPanel(rel)
                        }
                      >
                        {isEditing ? "訂正を閉じる" : "訂正"}
                      </Button>
                      <Button
                        variant={isEndingThis ? "tonal" : "outlined"}
                        size="sm"
                        onClick={() => toggleEndPanel(rel)}
                      >
                        {isEndingThis ? "終了を閉じる" : "関係を終了"}
                      </Button>
                    </div>
                  </td>
                </tr>

                {isEditing || isEndingThis || isHistoryOpen ? (
                  <tr {...stylex.props(s.tableRow)}>
                    <td colSpan={6} {...stylex.props(s.detailRowCell)}>
                      <CorporateRelationActionPanels
                        relation={rel}
                        isEditing={isEditing}
                        editValidFrom={editValidFrom}
                        onEditValidFromChange={setEditValidFrom}
                        editValidTo={editValidTo}
                        onEditValidToChange={setEditValidTo}
                        editEvidence={editEvidence}
                        onEditEvidenceChange={setEditEvidence}
                        isCorrecting={isCorrecting}
                        correctErrorMessage={correctErrorMessage}
                        onSubmitCorrect={(e, r) => void handleCorrectSubmit(e, r)}
                        isEndingThis={isEndingThis}
                        endValidTo={endValidTo}
                        onEndValidToChange={setEndValidTo}
                        isEnding={isEnding}
                        endErrorMessage={endErrorMessage}
                        onSubmitEnd={(e, id) => void handleEndSubmit(e, id)}
                        isHistoryOpen={isHistoryOpen}
                        revisions={revisions}
                        isLoadingRevisions={isLoadingRevisions}
                        revisionsErrorMessage={revisionsErrorMessage}
                      />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </section>
  );

  const viewTabs: readonly TabItem[] = [
    {
      value: "tree",
      label: "関係図（階層ツリー）",
      content:
        viewMode === "tree" ? (
          <CorporateRelationTreeView
            graph={graph}
            editingRelationId={editingRelationId}
            editValidFrom={editValidFrom}
            onEditValidFromChange={setEditValidFrom}
            editValidTo={editValidTo}
            onEditValidToChange={setEditValidTo}
            editEvidence={editEvidence}
            onEditEvidenceChange={setEditEvidence}
            isCorrecting={isCorrecting}
            correctErrorMessage={correctErrorMessage}
            onOpenEdit={openEditPanel}
            onCloseEdit={() => setEditingRelationId(null)}
            onSubmitCorrect={(e, rel) => void handleCorrectSubmit(e, rel)}
            endingRelationId={endingRelationId}
            endValidTo={endValidTo}
            onEndValidToChange={setEndValidTo}
            isEnding={isEnding}
            endErrorMessage={endErrorMessage}
            onToggleEnd={toggleEndPanel}
            onSubmitEnd={(e, relId) => void handleEndSubmit(e, relId)}
            selectedHistoryRelationId={selectedHistoryRelationId}
            onSelectHistoryRelation={onSelectHistoryRelation}
            revisions={revisions}
            isLoadingRevisions={isLoadingRevisions}
            revisionsErrorMessage={revisionsErrorMessage}
          />
        ) : null,
    },
    {
      value: "table",
      label: "一覧テーブル",
      content: viewMode === "table" ? tableContent : null,
    },
  ];

  return (
    <div data-vendor-console="" {...stylex.props(layout.page)}>
      <div {...stylex.props(layout.container)}>
        <VendorConsoleHeader
          title="法人間関係管理"
          activeSection="relations"
          currentUser={currentUser}
          isLoggingOut={isLoggingOut}
          onLogout={onLogout}
        />

        <section aria-labelledby="relation-list-heading" {...stylex.props(layout.panel)}>
          <div {...stylex.props(s.listHeaderRow)}>
            <div {...stylex.props(s.sectionHeader)}>
              <h2 id="relation-list-heading" {...stylex.props(layout.panelHeading)}>
                法人間関係一覧（{totalCount}件）
              </h2>
              <p {...stylex.props(s.sectionDescription)}>
                親子関係・関連会社・FC/VC
                契約を階層ツリーや一覧テーブルで確認し、訂正・終了・改訂履歴の管理ができます。
              </p>
            </div>
            <Link href="/vendor/corporations/relations/new" {...stylex.props(s.primaryLinkButton)}>
              新規関係を登録
            </Link>
          </div>

          {notice === "created" ? (
            <Alert
              tone="success"
              title="法人間関係を登録しました"
              onDismiss={onDismissNotice}
              dismissLabel="登録完了メッセージを閉じる"
            >
              <p>新しい法人間関係を登録しました。</p>
            </Alert>
          ) : null}

          <search aria-label="法人間関係の絞り込み" {...stylex.props(s.formGrid)}>
            <Select
              label="対象法人"
              name="filter_corporation_id"
              items={corpFilterOptions}
              value={filter.corporation_id ?? "all"}
              onValueChange={(value) =>
                onFilterChange({
                  ...filter,
                  corporation_id: value && value !== "all" ? value : undefined,
                })
              }
            />
            <TextField
              label="有効基準日"
              name="filter_as_of"
              type="date"
              value={filter.as_of ?? ""}
              onValueChange={(value) =>
                onFilterChange({
                  ...filter,
                  as_of: value || undefined,
                })
              }
            />
            <Select
              label="関係種別"
              name="filter_relation_type"
              items={RELATION_TYPE_FILTER_OPTIONS}
              value={filter.relation_type ?? "all"}
              onValueChange={(value) =>
                onFilterChange({
                  ...filter,
                  relation_type:
                    value === "parent_child" || value === "affiliate" || value === "fc_vc"
                      ? value
                      : undefined,
                })
              }
            />
          </search>

          {isLoadingRelations ? (
            <Spinner label="法人間関係を読み込み中…" showLabel />
          ) : relationsErrorMessage ? (
            <Alert tone="error" title="一覧を取得できませんでした" role="alert">
              {relationsErrorMessage}
            </Alert>
          ) : relations.length === 0 ? (
            <p {...stylex.props(s.emptyState)}>条件に一致する法人間関係はありません。</p>
          ) : (
            <Tabs
              aria-label="法人間関係の表示形式"
              variant="secondary"
              items={viewTabs}
              value={viewMode}
              onValueChange={(nextValue) => {
                if (nextValue === "tree" || nextValue === "table") {
                  setViewMode(nextValue);
                }
              }}
            />
          )}
        </section>
      </div>
    </div>
  );
}
