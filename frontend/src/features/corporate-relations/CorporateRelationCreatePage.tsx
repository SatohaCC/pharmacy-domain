"use client";

import * as stylex from "@stylexjs/stylex";
import Link from "next/link";
import { useState } from "react";
import type { AuthUser } from "@/features/auth/schemas";
import { VendorConsoleHeader } from "@/features/auth/VendorConsoleHeader";
import { vendorConsoleLayoutStyles as layout } from "@/features/auth/VendorConsoleLayout.styles";
import { formatCorporationOptionLabel } from "@/features/corporations/formatCorporationLabel";
import type { Corporation } from "@/features/corporations/schemas";
import { Alert } from "@/shared/ui/alert/Alert";
import { Button } from "@/shared/ui/button/Button";
import { Select, type SelectOption } from "@/shared/ui/select/Select";
import { TextField } from "@/shared/ui/text-field/TextField";
import { corporateRelationsWorkspaceStyles as s } from "./CorporateRelationsWorkspace.styles";
import type { RelationType } from "./schemas";

const RELATION_TYPE_OPTIONS: readonly SelectOption[] = [
  { value: "parent_child", label: "親子関係" },
  { value: "affiliate", label: "関連会社" },
  { value: "fc_vc", label: "FC / VC 契約" },
];

export interface CorporateRelationCreatePageProps {
  currentUser: AuthUser;
  corporations: readonly Corporation[];
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
  isLoggingOut: boolean;
  onLogout: () => void;
  backHref?: string;
}

/** 新規法人間関係の登録画面。 */
export function CorporateRelationCreatePage({
  currentUser,
  corporations,
  isRegistering,
  registerErrorMessage,
  onRegisterRelation,
  isLoggingOut,
  onLogout,
  backHref = "/vendor/corporations/relations",
}: CorporateRelationCreatePageProps) {
  const [sourceCorpId, setSourceCorpId] = useState("");
  const [targetCorpId, setTargetCorpId] = useState("");
  const [relationType, setRelationType] = useState<RelationType>("parent_child");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [evidence, setEvidence] = useState("");
  const [formError, setFormError] = useState<string | undefined>(undefined);

  const corpOptions: readonly SelectOption[] = [
    { value: "", label: "法人を選択してください" },
    ...corporations.map((corp) => ({
      value: corp.id,
      label: formatCorporationOptionLabel(corp),
    })),
  ];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isRegistering) return;

    if (!sourceCorpId || !targetCorpId) {
      setFormError("元法人（親・関連元）と先法人（子・関連先）を選択してください。");
      return;
    }
    if (!validFrom.trim()) {
      setFormError("有効開始日を入力してください。");
      return;
    }
    if (!evidence.trim()) {
      setFormError("根拠資料・契約内容を入力してください。");
      return;
    }
    setFormError(undefined);
    await onRegisterRelation({
      source_corporation_id: sourceCorpId,
      target_corporation_id: targetCorpId,
      relation_type: relationType,
      valid_from: validFrom.trim(),
      valid_to: validTo.trim() || null,
      evidence: evidence.trim(),
    });
  }

  return (
    <div data-vendor-console="" {...stylex.props(layout.page)}>
      <div {...stylex.props(layout.container)}>
        <VendorConsoleHeader
          title="新規法人間関係の登録"
          activeSection="relations"
          currentUser={currentUser}
          isLoggingOut={isLoggingOut}
          onLogout={onLogout}
        />

        <section aria-labelledby="relation-create-heading" {...stylex.props(layout.panel)}>
          <div {...stylex.props(s.listHeaderRow)}>
            <p id="relation-create-heading" {...stylex.props(s.sectionDescription)}>
              親子関係・関連会社・FC/VC 契約を根拠資料と有効期間付きで登録します。
            </p>
            <Link href={backHref} {...stylex.props(s.outlinedLinkButton)}>
              法人間関係一覧へ戻る
            </Link>
          </div>

          {formError || registerErrorMessage ? (
            <Alert tone="error" title="登録に失敗しました" role="alert">
              <p>{formError ?? registerErrorMessage}</p>
            </Alert>
          ) : null}

          <form
            aria-label="新規法人間関係登録フォーム"
            onSubmit={(e) => void handleSubmit(e)}
            noValidate
            {...stylex.props(s.formStack)}
          >
            <fieldset {...stylex.props(s.fieldset)}>
              <legend {...stylex.props(s.legend)}>法人間関係の情報</legend>
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
            </fieldset>

            <div {...stylex.props(s.submitRow)}>
              <Link href={backHref} {...stylex.props(s.textLinkButton)}>
                キャンセル
              </Link>
              <Button type="submit" variant="filled" disabled={isRegistering}>
                {isRegistering ? "登録中…" : "法人間関係を登録"}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
