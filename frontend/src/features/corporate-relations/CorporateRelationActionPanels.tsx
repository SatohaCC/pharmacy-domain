"use client";

import * as stylex from "@stylexjs/stylex";
import { Alert } from "@/shared/ui/alert/Alert";
import { Button } from "@/shared/ui/button/Button";
import { Spinner } from "@/shared/ui/spinner/Spinner";
import { TextField } from "@/shared/ui/text-field/TextField";
import { corporateRelationsWorkspaceStyles as s } from "./CorporateRelationsWorkspace.styles";
import type { CorporateRelation, CorporateRelationRevision } from "./schemas";

export interface CorporateRelationActionPanelsProps {
  relation: CorporateRelation;
  isEditing: boolean;
  editValidFrom: string;
  onEditValidFromChange: (value: string) => void;
  editValidTo: string;
  onEditValidToChange: (value: string) => void;
  editEvidence: string;
  onEditEvidenceChange: (value: string) => void;
  isCorrecting: boolean;
  correctErrorMessage: string | null;
  onSubmitCorrect: (event: React.FormEvent<HTMLFormElement>, rel: CorporateRelation) => void;
  isEndingThis: boolean;
  endValidTo: string;
  onEndValidToChange: (value: string) => void;
  isEnding: boolean;
  endErrorMessage: string | null;
  onSubmitEnd: (event: React.FormEvent<HTMLFormElement>, relId: string) => void;
  isHistoryOpen: boolean;
  revisions: readonly CorporateRelationRevision[];
  isLoadingRevisions: boolean;
  revisionsErrorMessage: string | null;
}

/** 法人間関係（訂正・終了・改訂履歴）の共通インライン操作パネル。 */
export function CorporateRelationActionPanels({
  relation,
  isEditing,
  editValidFrom,
  onEditValidFromChange,
  editValidTo,
  onEditValidToChange,
  editEvidence,
  onEditEvidenceChange,
  isCorrecting,
  correctErrorMessage,
  onSubmitCorrect,
  isEndingThis,
  endValidTo,
  onEndValidToChange,
  isEnding,
  endErrorMessage,
  onSubmitEnd,
  isHistoryOpen,
  revisions,
  isLoadingRevisions,
  revisionsErrorMessage,
}: CorporateRelationActionPanelsProps) {
  if (!isEditing && !isEndingThis && !isHistoryOpen) {
    return null;
  }

  return (
    <div {...stylex.props(s.formStack)}>
      {isEditing ? (
        <form
          onSubmit={(e) => onSubmitCorrect(e, relation)}
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
              name={`edit_valid_from_${relation.id}`}
              type="date"
              value={editValidFrom}
              onValueChange={onEditValidFromChange}
              disabled={isCorrecting}
            />
            <TextField
              label="訂正後の有効終了日"
              name={`edit_valid_to_${relation.id}`}
              type="date"
              value={editValidTo}
              onValueChange={onEditValidToChange}
              disabled={isCorrecting}
            />
            <TextField
              label="根拠・契約メモ"
              name={`edit_evidence_${relation.id}`}
              value={editEvidence}
              onValueChange={onEditEvidenceChange}
              disabled={isCorrecting}
            />
          </div>
          <div {...stylex.props(s.submitRow)}>
            <Button type="submit" variant="filled" size="sm" disabled={isCorrecting}>
              {isCorrecting ? "保存中…" : "訂正を保存"}
            </Button>
          </div>
        </form>
      ) : null}

      {isEndingThis ? (
        <form
          onSubmit={(e) => onSubmitEnd(e, relation.id)}
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
            label="終了日"
            name={`end_valid_to_${relation.id}`}
            type="date"
            value={endValidTo}
            onValueChange={onEndValidToChange}
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
    </div>
  );
}
