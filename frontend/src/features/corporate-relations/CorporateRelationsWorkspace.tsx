"use client";

import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import type { AuthUser } from "@/features/auth/schemas";
import { VendorConsoleHeader } from "@/features/auth/VendorConsoleHeader";
import { vendorConsoleLayoutStyles as layout } from "@/features/auth/VendorConsoleLayout.styles";
import { formatCorporationOptionLabel } from "@/features/corporations/formatCorporationLabel";
import type { Corporation } from "@/features/corporations/schemas";
import { Alert } from "@/shared/ui/alert/Alert";
import { Badge } from "@/shared/ui/badge/Badge";
import { Button } from "@/shared/ui/button/Button";
import { Select, type SelectOption } from "@/shared/ui/select/Select";
import { Spinner } from "@/shared/ui/spinner/Spinner";
import { TextField } from "@/shared/ui/text-field/TextField";
import { corporateRelationsWorkspaceStyles as s } from "./CorporateRelationsWorkspace.styles";
import type {
  CorporateRelation,
  CorporateRelationListFilter,
  CorporateRelationRevision,
  RelationType,
} from "./schemas";

const RELATION_TYPE_OPTIONS: readonly SelectOption[] = [
  { value: "parent_child", label: "親子関係 (parent_child)" },
  { value: "affiliate", label: "関連会社 (affiliate)" },
  { value: "fc_vc", label: "FC / VC 契約 (fc_vc)" },
];

const RELATION_TYPE_FILTER_OPTIONS: readonly SelectOption[] = [
  { value: "all", label: "すべての関係種別" },
  ...RELATION_TYPE_OPTIONS,
];

function relationTypeLabel(type: RelationType): string {
  switch (type) {
    case "parent_child":
      return "親子関係";
    case "affiliate":
      return "関連会社";
    case "fc_vc":
      return "FC / VC 契約";
  }
}

export interface CorporateRelationsWorkspaceProps {
  currentUser: AuthUser;
  corporations: readonly Corporation[];
  relations: readonly CorporateRelation[];
  totalCount: number;
  filter: CorporateRelationListFilter;
  onFilterChange: (next: CorporateRelationListFilter) => void;
  isLoadingRelations: boolean;
  relationsErrorMessage: string | null;
  isRegistering: boolean;
  registerErrorMessage: string | null;
  onRegisterRelation: (input: {
    source_corporation_id: string;
    target_corporation_id: string;
    relation_type: RelationType;
    valid_from: string;
    valid_to?: string | null;
    evidence: string;
  }) => Promise<boolean>;
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
}

/** 法人間関係の登録・検索・訂正・終了・改訂履歴管理ワークスペース。 */
export function CorporateRelationsWorkspace({
  currentUser,
  corporations,
  relations,
  totalCount,
  filter,
  onFilterChange,
  isLoadingRelations,
  relationsErrorMessage,
  isRegistering,
  registerErrorMessage,
  onRegisterRelation,
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
}: CorporateRelationsWorkspaceProps) {
  const [sourceCorpId, setSourceCorpId] = useState("");
  const [targetCorpId, setTargetCorpId] = useState("");
  const [relationType, setRelationType] = useState<RelationType>("parent_child");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [evidence, setEvidence] = useState("");
  const [createFormError, setCreateFormError] = useState<string | undefined>(undefined);

  const [editingRelationId, setEditingRelationId] = useState<string | null>(null);
  const [editValidFrom, setEditValidFrom] = useState("");
  const [editValidTo, setEditValidTo] = useState("");
  const [editEvidence, setEditEvidence] = useState("");

  const [endingRelationId, setEndingRelationId] = useState<string | null>(null);
  const [endValidTo, setEndValidTo] = useState("");

  const corporationNameById = new Map(corporations.map((corp) => [corp.id, corp.name]));
  const corpOptions: readonly SelectOption[] = [
    { value: "", label: "法人を選択してください" },
    ...corporations.map((corp) => ({
      value: corp.id,
      label: formatCorporationOptionLabel(corp),
    })),
  ];
  const corpFilterOptions: readonly SelectOption[] = [
    { value: "all", label: "すべての法人" },
    ...corporations.map((corp) => ({
      value: corp.id,
      label: formatCorporationOptionLabel(corp),
    })),
  ];

  async function handleRegisterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sourceCorpId || !targetCorpId) {
      setCreateFormError("元法人（親・関連元）と先法人（子・関連先）を選択してください。");
      return;
    }
    if (!validFrom.trim()) {
      setCreateFormError("有効開始日を入力してください。");
      return;
    }
    if (!evidence.trim()) {
      setCreateFormError("根拠資料・契約内容を入力してください。");
      return;
    }
    setCreateFormError(undefined);
    const ok = await onRegisterRelation({
      source_corporation_id: sourceCorpId,
      target_corporation_id: targetCorpId,
      relation_type: relationType,
      valid_from: validFrom.trim(),
      valid_to: validTo.trim() || null,
      evidence: evidence.trim(),
    });
    if (ok) {
      setSourceCorpId("");
      setTargetCorpId("");
      setValidFrom("");
      setValidTo("");
      setEvidence("");
    }
  }

  function openEditPanel(rel: CorporateRelation) {
    setEndingRelationId(null);
    setEditingRelationId(rel.id);
    setEditValidFrom(rel.valid_from);
    setEditValidTo(rel.valid_to ?? "");
    setEditEvidence(rel.evidence);
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

  return (
    <div {...stylex.props(layout.page)}>
      <div {...stylex.props(layout.container)}>
        <VendorConsoleHeader
          title="法人間関係管理"
          activeSection="relations"
          currentUser={currentUser}
          isLoggingOut={isLoggingOut}
          onLogout={onLogout}
        />

        <div {...stylex.props(layout.panels)}>
          <section aria-labelledby="relation-create-heading" {...stylex.props(layout.panel)}>
            <div {...stylex.props(s.sectionHeader)}>
              <h2 id="relation-create-heading" {...stylex.props(layout.panelHeading)}>
                新規法人間関係を登録
              </h2>
              <p {...stylex.props(s.sectionDescription)}>
                親子関係・関連会社・FC/VC 契約を根拠資料と有効期間付きで登録します。
              </p>
            </div>

            {createFormError || registerErrorMessage ? (
              <Alert tone="error" title="登録に失敗しました" role="alert">
                <p>{createFormError ?? registerErrorMessage}</p>
              </Alert>
            ) : null}

            <form
              onSubmit={(e) => void handleRegisterSubmit(e)}
              noValidate
              {...stylex.props(s.formStack)}
            >
              <div {...stylex.props(s.formGrid)}>
                <Select
                  label="関係元法人（親・本部等）"
                  name="source_corporation_id"
                  items={corpOptions}
                  value={sourceCorpId}
                  onValueChange={(value) => setSourceCorpId(value ?? "")}
                  disabled={isRegistering}
                />
                <Select
                  label="関係先法人（子・加盟店等）"
                  name="target_corporation_id"
                  items={corpOptions}
                  value={targetCorpId}
                  onValueChange={(value) => setTargetCorpId(value ?? "")}
                  disabled={isRegistering}
                />
                <Select
                  label="関係種別"
                  name="relation_type"
                  items={RELATION_TYPE_OPTIONS}
                  value={relationType}
                  onValueChange={(value) => {
                    if (value === "parent_child" || value === "affiliate" || value === "fc_vc") {
                      setRelationType(value);
                    }
                  }}
                  disabled={isRegistering}
                />
                <TextField
                  label="有効開始日"
                  name="valid_from"
                  type="date"
                  value={validFrom}
                  onValueChange={setValidFrom}
                  required
                  disabled={isRegistering}
                />
                <TextField
                  label="有効終了日（任意）"
                  name="valid_to"
                  type="date"
                  value={validTo}
                  onValueChange={setValidTo}
                  disabled={isRegistering}
                />
              </div>

              <TextField
                label="根拠・契約メモ"
                name="evidence"
                value={evidence}
                onValueChange={setEvidence}
                placeholder="例: 資本提携契約書 / 株主名簿確認"
                required
                disabled={isRegistering}
              />

              <div {...stylex.props(s.submitRow)}>
                <Button type="submit" variant="filled" disabled={isRegistering}>
                  {isRegistering ? "登録中…" : "法人間関係を登録"}
                </Button>
              </div>
            </form>
          </section>

          <section aria-labelledby="relation-list-heading" {...stylex.props(layout.panel)}>
            <div {...stylex.props(s.sectionHeader)}>
              <h2 id="relation-list-heading" {...stylex.props(layout.panelHeading)}>
                法人間関係一覧（{totalCount}件）
              </h2>
            </div>

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
                label="有効基準日 (as_of)"
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
              <ul {...stylex.props(s.relationList)}>
                {relations.map((rel) => {
                  const sourceName =
                    corporationNameById.get(rel.source_corporation_id) ?? rel.source_corporation_id;
                  const targetName =
                    corporationNameById.get(rel.target_corporation_id) ?? rel.target_corporation_id;
                  const isEditing = editingRelationId === rel.id;
                  const isEndingThis = endingRelationId === rel.id;
                  const isHistoryOpen = selectedHistoryRelationId === rel.id;

                  return (
                    <li key={rel.id} {...stylex.props(s.relationItem)}>
                      <div {...stylex.props(s.itemHeader)}>
                        <div {...stylex.props(s.itemMainInfo)}>
                          <div {...stylex.props(s.titleRow)}>
                            <p {...stylex.props(s.relationTitle)}>
                              {sourceName} → {targetName}
                            </p>
                            <Badge tone="neutral">{relationTypeLabel(rel.relation_type)}</Badge>
                          </div>
                          <p {...stylex.props(s.metaGrid)}>
                            <span>
                              有効期間: {rel.valid_from} 〜 {rel.valid_to ?? "終了未定"}
                            </span>
                            <span>根拠: {rel.evidence}</span>
                            <span>変更者: {rel.recorded_by ?? "不明"}</span>
                          </p>
                        </div>

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
                            onClick={() => {
                              if (!isEndingThis) {
                                setEditingRelationId(null);
                              }
                              setEndingRelationId(isEndingThis ? null : rel.id);
                              setEndValidTo("");
                            }}
                          >
                            {isEndingThis ? "終了を閉じる" : "関係を終了"}
                          </Button>
                        </div>
                      </div>

                      {isEditing ? (
                        <form
                          onSubmit={(e) => void handleCorrectSubmit(e, rel)}
                          noValidate
                          {...stylex.props(s.panelBox)}
                        >
                          <h3 {...stylex.props(s.subTitle)}>関係の訂正</h3>
                          {correctErrorMessage ? (
                            <Alert tone="error" title="訂正に失敗しました" role="alert">
                              {correctErrorMessage}
                            </Alert>
                          ) : null}
                          <div {...stylex.props(s.formGrid)}>
                            <TextField
                              label="訂正後の有効開始日"
                              name={`edit_valid_from_${rel.id}`}
                              type="date"
                              value={editValidFrom}
                              onValueChange={setEditValidFrom}
                              disabled={isCorrecting}
                            />
                            <TextField
                              label="訂正後の有効終了日"
                              name={`edit_valid_to_${rel.id}`}
                              type="date"
                              value={editValidTo}
                              onValueChange={setEditValidTo}
                              disabled={isCorrecting}
                            />
                            <TextField
                              label="根拠・契約メモ"
                              name={`edit_evidence_${rel.id}`}
                              value={editEvidence}
                              onValueChange={setEditEvidence}
                              disabled={isCorrecting}
                            />
                          </div>
                          <div {...stylex.props(s.submitRow)}>
                            <Button
                              type="submit"
                              variant="filled"
                              size="sm"
                              disabled={isCorrecting}
                            >
                              {isCorrecting ? "保存中…" : "訂正を保存"}
                            </Button>
                          </div>
                        </form>
                      ) : null}

                      {isEndingThis ? (
                        <form
                          onSubmit={(e) => void handleEndSubmit(e, rel.id)}
                          noValidate
                          {...stylex.props(s.panelBox)}
                        >
                          <h3 {...stylex.props(s.subTitle)}>関係を終了</h3>
                          {endErrorMessage ? (
                            <Alert tone="error" title="終了処理に失敗しました" role="alert">
                              {endErrorMessage}
                            </Alert>
                          ) : null}
                          <TextField
                            label="終了日 (valid_to)"
                            name={`end_valid_to_${rel.id}`}
                            type="date"
                            value={endValidTo}
                            onValueChange={setEndValidTo}
                            required
                            disabled={isEnding}
                          />
                          <div {...stylex.props(s.submitRow)}>
                            <Button type="submit" variant="filled" size="sm" disabled={isEnding}>
                              {isEnding ? "終了処理中…" : "この日で終了"}
                            </Button>
                          </div>
                        </form>
                      ) : null}

                      {isHistoryOpen ? (
                        <div {...stylex.props(s.panelBox)}>
                          <h3 {...stylex.props(s.subTitle)}>改訂履歴</h3>
                          {isLoadingRevisions ? (
                            <Spinner label="改訂履歴を読み込み中…" showLabel />
                          ) : revisionsErrorMessage ? (
                            <Alert tone="error" title="改訂履歴を取得できませんでした" role="alert">
                              {revisionsErrorMessage}
                            </Alert>
                          ) : (
                            <ul {...stylex.props(s.relationList)}>
                              {revisions.map((rev) => (
                                <li key={rev.recorded_at} {...stylex.props(s.relationItem)}>
                                  <p {...stylex.props(s.metaGrid)}>
                                    <span>
                                      有効期間: {rev.valid_from} 〜 {rev.valid_to ?? "終了未定"}
                                    </span>
                                    <span>根拠: {rev.evidence}</span>
                                    <span>記録日時: {rev.recorded_at}</span>
                                    <span>変更者: {rev.recorded_by ?? "不明"}</span>
                                  </p>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
