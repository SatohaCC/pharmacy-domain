"use client";

import * as stylex from "@stylexjs/stylex";
import Link from "next/link";
import { useState } from "react";
import type { AuthUser } from "@/features/auth/schemas";
import { VendorConsoleHeader } from "@/features/auth/VendorConsoleHeader";
import { vendorConsoleLayoutStyles as layout } from "@/features/auth/VendorConsoleLayout.styles";
import type { ApiUserFacingError } from "@/shared/lib/api/apiClient";
import { Alert } from "@/shared/ui/alert/Alert";
import { Badge } from "@/shared/ui/badge/Badge";
import { Button } from "@/shared/ui/button/Button";
import { Dialog, DialogCloseButton } from "@/shared/ui/dialog/Dialog";
import { RadioGroup, type RadioOption } from "@/shared/ui/radio-group/RadioGroup";
import { Select, type SelectOption } from "@/shared/ui/select/Select";
import { type TabItem, Tabs } from "@/shared/ui/tabs/Tabs";
import { TextField } from "@/shared/ui/text-field/TextField";
import { CorporationHistoryPanel } from "./CorporationHistoryPanel";
import { corporationsWorkspaceStyles as s } from "./CorporationsWorkspace.styles";
import type {
  Corporation,
  CorporationCategory,
  CorporationHistoryRecord,
  CorporationStatus,
  CorporationUsageStatus,
} from "./schemas";

const CATEGORY_RADIO_ITEMS: readonly RadioOption[] = [
  { value: "corporation", label: "法人（株式会社・有限会社等）" },
  { value: "individual", label: "個人開設者" },
];

const USAGE_STATUS_OPTIONS: readonly SelectOption[] = [
  { value: "not_started", label: "未利用（参照専用）" },
  { value: "active", label: "利用中" },
  { value: "suspended", label: "利用停止" },
];

function categoryLabel(category: CorporationCategory): string {
  return category === "corporation" ? "法人" : "個人開設者";
}

function statusLabel(status: CorporationStatus): string {
  switch (status) {
    case "active":
      return "存続";
    case "dissolved":
      return "解散";
    case "merged_out":
      return "合併消滅";
  }
}

function statusTone(status: CorporationStatus): "success" | "neutral" | "danger" {
  switch (status) {
    case "active":
      return "success";
    case "dissolved":
      return "neutral";
    case "merged_out":
      return "danger";
  }
}

function usageStatusLabel(status: CorporationUsageStatus): string {
  switch (status) {
    case "not_started":
      return "未利用";
    case "active":
      return "利用中";
    case "suspended":
      return "利用停止";
  }
}

function usageStatusTone(status: CorporationUsageStatus): "success" | "neutral" | "danger" {
  switch (status) {
    case "active":
      return "success";
    case "not_started":
      return "neutral";
    case "suspended":
      return "danger";
  }
}

function validateCorporateNumber(
  category: CorporationCategory,
  rawValue: string,
): string | undefined {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return undefined;
  }
  if (category === "individual") {
    return "個人開設者には法人番号を設定できません。";
  }
  if (!/^\d{13}$/.test(trimmed)) {
    return "法人番号は半角数字13桁で入力してください。";
  }
  return undefined;
}

function validateValidTo(validFrom: string, validTo: string): string | undefined {
  const trimmedTo = validTo.trim();
  if (!trimmedTo) {
    return undefined;
  }
  const trimmedFrom = validFrom.trim();
  if (trimmedFrom && trimmedTo <= trimmedFrom) {
    return "有効終了日は有効開始日より後の日付を指定してください。";
  }
  return undefined;
}

export interface CorporationFormPageProps {
  mode: "create" | "edit";
  currentUser: AuthUser;
  initialCorporation?: Corporation;
  isSubmitting: boolean;
  submitErrorMessage: string | null;
  submitUserFacingError: ApiUserFacingError | null;
  onCreateCorporation?: (input: {
    category: CorporationCategory;
    name: string;
    representative_name: string;
    corporate_number?: string | null;
    address?: string;
    valid_from?: string | null;
    valid_to?: string | null;
    evidence?: string | null;
    usage_status?: CorporationUsageStatus;
  }) => Promise<boolean>;
  onUpdateCorporation?: (
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
  ) => Promise<boolean>;
  isChangingUsageStatus?: boolean;
  usageStatusErrorMessage?: string | null;
  onChangeUsageStatus?: (
    corporationId: string,
    usageStatus: CorporationUsageStatus,
  ) => Promise<boolean>;
  activeCorporations?: readonly Corporation[];
  historyRecords?: readonly CorporationHistoryRecord[];
  isLoadingHistory?: boolean;
  historyErrorMessage?: string | null;
  snapshotParams?: { as_of?: string; recorded_as_of?: string } | null;
  onLookupSnapshot?: (params: { as_of?: string; recorded_as_of?: string } | null) => void;
  snapshotCorporation?: Corporation | null;
  isLoadingSnapshot?: boolean;
  snapshotErrorMessage?: string | null;
  isChangingStatus?: boolean;
  statusErrorMessage?: string | null;
  onChangeStatus?: (
    corporationId: string,
    input: {
      status: "dissolved" | "merged_out";
      effective_date?: string | null;
      surviving_corporation_id?: string | null;
      evidence?: string | null;
    },
  ) => Promise<boolean>;
  isCorrectingHistory?: boolean;
  correctionErrorMessage?: string | null;
  onCorrectHistory?: (
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
  ) => Promise<boolean>;
  isLoggingOut: boolean;
  onLogout: () => void;
  backHref?: string;
}

/** 企業の登録・基本情報編集・利用状態管理・履歴管理を共通で扱う画面。 */
export function CorporationFormPage({
  mode,
  currentUser,
  initialCorporation,
  isSubmitting,
  submitErrorMessage,
  submitUserFacingError,
  onCreateCorporation,
  onUpdateCorporation,
  isChangingUsageStatus = false,
  usageStatusErrorMessage = null,
  onChangeUsageStatus,
  activeCorporations = [],
  historyRecords = [],
  isLoadingHistory = false,
  historyErrorMessage = null,
  snapshotParams = null,
  onLookupSnapshot,
  snapshotCorporation = null,
  isLoadingSnapshot = false,
  snapshotErrorMessage = null,
  isChangingStatus = false,
  statusErrorMessage = null,
  onChangeStatus,
  isCorrectingHistory = false,
  correctionErrorMessage = null,
  onCorrectHistory,
  isLoggingOut,
  onLogout,
  backHref = "/vendor/corporations",
}: CorporationFormPageProps) {
  const isEdit = mode === "edit";
  const [category, setCategory] = useState<CorporationCategory>(
    initialCorporation?.category ?? "corporation",
  );
  const [name, setName] = useState(initialCorporation?.name ?? "");
  const [representativeName, setRepresentativeName] = useState(
    initialCorporation?.representative_name ?? "",
  );
  const [corporateNumber, setCorporateNumber] = useState(
    initialCorporation?.corporate_number ?? "",
  );
  const [address, setAddress] = useState(initialCorporation?.address ?? "");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState(initialCorporation?.valid_to ?? "");
  const [evidence, setEvidence] = useState("");
  const [usageStatus, setUsageStatus] = useState<CorporationUsageStatus>("not_started");
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isUsageDialogOpen, setIsUsageDialogOpen] = useState(false);

  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [representativeNameError, setRepresentativeNameError] = useState<string | undefined>(
    undefined,
  );
  const [corporateNumberError, setCorporateNumberError] = useState<string | undefined>(undefined);
  const [validToError, setValidToError] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | undefined>(undefined);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const trimmedName = name.trim();
    const trimmedRepresentativeName = representativeName.trim();
    const trimmedNumber = corporateNumber.trim();
    const trimmedAddress = address.trim();
    const trimmedValidFrom = validFrom.trim();
    const trimmedValidTo = validTo.trim();
    const trimmedEvidence = evidence.trim();

    const nextNameError = trimmedName
      ? undefined
      : isEdit
        ? "変更後の名称を入力してください。"
        : "法人名（または個人開設者の氏名・屋号）を入力してください。";
    const nextRepresentativeNameError = trimmedRepresentativeName
      ? undefined
      : category === "individual"
        ? isEdit
          ? "変更後の開設者氏名を入力してください。"
          : "開設者氏名を入力してください。"
        : isEdit
          ? "変更後の代表者名を入力してください。"
          : "代表者名を入力してください。";
    const nextNumberError = validateCorporateNumber(category, trimmedNumber);
    const nextValidToError = validateValidTo(trimmedValidFrom, trimmedValidTo);

    setNameError(nextNameError);
    setRepresentativeNameError(nextRepresentativeNameError);
    setCorporateNumberError(nextNumberError);
    setValidToError(nextValidToError);

    if (nextValidToError) {
      setIsDetailsOpen(true);
    }

    if (nextNameError || nextRepresentativeNameError || nextNumberError || nextValidToError) {
      return;
    }

    if (!isEdit) {
      if (!onCreateCorporation) return;
      await onCreateCorporation({
        category,
        name: trimmedName,
        representative_name: trimmedRepresentativeName,
        corporate_number: category === "corporation" && trimmedNumber ? trimmedNumber : null,
        address: trimmedAddress,
        valid_from: trimmedValidFrom || null,
        valid_to: trimmedValidTo || null,
        evidence: trimmedEvidence || null,
        usage_status: usageStatus,
      });
      return;
    }

    if (!initialCorporation || !onUpdateCorporation) return;

    const payload: {
      name?: string | null;
      representative_name?: string | null;
      corporate_number?: string | null;
      address?: string | null;
      valid_from?: string | null;
      valid_to?: string | null;
      evidence?: string | null;
    } = {};

    if (trimmedName !== initialCorporation.name) {
      payload.name = trimmedName;
    }
    if (trimmedRepresentativeName !== initialCorporation.representative_name) {
      payload.representative_name = trimmedRepresentativeName;
    }
    if (
      initialCorporation.category === "corporation" &&
      trimmedNumber !== (initialCorporation.corporate_number ?? "")
    ) {
      payload.corporate_number = trimmedNumber || null;
    }
    if (trimmedAddress !== initialCorporation.address) {
      payload.address = trimmedAddress;
    }
    if (trimmedValidTo !== (initialCorporation.valid_to ?? "")) {
      payload.valid_to = trimmedValidTo || null;
    }

    if (Object.keys(payload).length === 0) {
      setFormError(
        "変更された項目がありません。名称・代表者名・法人番号・所在地・有効終了日のいずれかを変更してください。",
      );
      return;
    }

    if (trimmedValidFrom) {
      payload.valid_from = trimmedValidFrom;
    }
    if (trimmedEvidence) {
      payload.evidence = trimmedEvidence;
    }

    setFormError(undefined);
    await onUpdateCorporation(initialCorporation.id, payload);
  }

  const pageTitle = isEdit
    ? "導入企業（法人・個人開設者）の編集・管理"
    : "新規企業（法人・個人開設者）の登録";
  const currentUsage = initialCorporation?.usage_status ?? "not_started";
  const nextUsage: CorporationUsageStatus = currentUsage === "active" ? "suspended" : "active";
  const isStoppingUsage = currentUsage === "active";

  const basicFormContent =
    isEdit && initialCorporation && initialCorporation.status !== "active" ? (
      <div {...stylex.props(s.formStack)}>
        <Alert tone="warning" title="基本情報は編集できません">
          <p>
            解散または合併消滅した法人の基本情報は変更できません。変更履歴の参照および過去履歴の訂正は「変更履歴・訂正」タブから行えます。
          </p>
        </Alert>
        <p {...stylex.props(s.metaGrid)}>
          <span>
            {initialCorporation.category === "individual" ? "開設者" : "代表者"}:{" "}
            {initialCorporation.representative_name || "未設定"}
          </span>
          <span>法人番号: {initialCorporation.corporate_number ?? "未設定"}</span>
          <span>所在地: {initialCorporation.address || "未設定"}</span>
          <span>
            法人ID: <code {...stylex.props(s.metaCode)}>{initialCorporation.id}</code>
          </span>
        </p>
      </div>
    ) : (
      <div {...stylex.props(s.formStack)}>
        {formError ? (
          <Alert tone="error" title="変更内容を確認してください" role="alert">
            <p>{formError}</p>
          </Alert>
        ) : null}

        {submitErrorMessage ? (
          <Alert
            tone="error"
            title={
              submitUserFacingError?.title ??
              (isEdit ? "基本情報を更新できませんでした" : "企業を登録できませんでした")
            }
            role="alert"
          >
            <p>{submitUserFacingError?.reason ?? submitErrorMessage}</p>
            {submitUserFacingError?.how_to_fix ? <p>{submitUserFacingError.how_to_fix}</p> : null}
          </Alert>
        ) : null}

        <form
          aria-label={isEdit ? "基本情報の編集フォーム" : "新規企業登録フォーム"}
          onSubmit={(e) => void handleSubmit(e)}
          noValidate
          {...stylex.props(s.formStack)}
        >
          <fieldset {...stylex.props(s.fieldset)}>
            <legend {...stylex.props(s.legend)}>基本情報</legend>

            <RadioGroup
              label="開設主体区分"
              name="category"
              orientation="horizontal"
              items={CATEGORY_RADIO_ITEMS}
              value={category}
              onValueChange={(value) => {
                if (isEdit) return;
                if (value === "corporation" || value === "individual") {
                  setCategory(value);
                  if (value === "individual") {
                    setCorporateNumber("");
                    setCorporateNumberError(undefined);
                  }
                }
              }}
              disabled={isEdit || isSubmitting}
            />

            <div {...stylex.props(s.formGrid)}>
              <TextField
                label="法人名（個人の場合は氏名・屋号）"
                name="name"
                placeholder="株式会社さくら薬局"
                value={name}
                onValueChange={(value) => {
                  setName(value);
                  if (nameError) setNameError(undefined);
                  if (formError) setFormError(undefined);
                }}
                errorMessage={nameError}
                required
                disabled={isSubmitting}
              />

              <TextField
                label={category === "individual" ? "開設者氏名" : "代表者名"}
                name="representative_name"
                placeholder="山田 太郎"
                value={representativeName}
                onValueChange={(value) => {
                  setRepresentativeName(value);
                  if (representativeNameError) setRepresentativeNameError(undefined);
                  if (formError) setFormError(undefined);
                }}
                errorMessage={representativeNameError}
                required
                disabled={isSubmitting}
              />

              <TextField
                label="法人番号（13桁）"
                name="corporate_number"
                inputMode="numeric"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={13}
                placeholder="1234567890123"
                description={
                  category === "individual"
                    ? "個人開設者は法人番号を入力できません"
                    : "半角数字13桁（任意・確認前の場合は空欄可）"
                }
                value={corporateNumber}
                onValueChange={(value) => {
                  setCorporateNumber(value);
                  if (corporateNumberError) setCorporateNumberError(undefined);
                  if (formError) setFormError(undefined);
                }}
                errorMessage={corporateNumberError}
                disabled={category === "individual" || isSubmitting}
              />

              <TextField
                label="本店または主たる事務所の所在地"
                name="address"
                autoComplete="street-address"
                placeholder="東京都新宿区1-2-3"
                value={address}
                onValueChange={(value) => {
                  setAddress(value);
                  if (formError) setFormError(undefined);
                }}
                disabled={isSubmitting}
              />
            </div>
          </fieldset>

          <details
            open={isDetailsOpen}
            onToggle={(e) => setIsDetailsOpen(e.currentTarget.open)}
            {...stylex.props(s.detailsBox)}
          >
            <summary {...stylex.props(s.detailsSummary)}>
              {isEdit
                ? "有効期間・確認根拠・識別情報（任意）"
                : "詳細設定（有効期間・確認根拠・初期利用状態）"}
            </summary>
            <div {...stylex.props(s.detailsBody)}>
              <div {...stylex.props(s.formGrid)}>
                <TextField
                  label={isEdit ? "変更の有効開始日（任意）" : "有効開始日（任意）"}
                  name="valid_from"
                  type="date"
                  description={isEdit ? undefined : "設立日または確認できた基準日"}
                  value={validFrom}
                  onValueChange={(value) => {
                    setValidFrom(value);
                    if (validToError) setValidToError(undefined);
                  }}
                  disabled={isSubmitting}
                />

                <TextField
                  label={isEdit ? "変更後の有効終了日（任意）" : "有効終了日（任意）"}
                  name="valid_to"
                  type="date"
                  description={
                    isEdit
                      ? "空欄にすると終了未定になります"
                      : "終了日が未定の場合は空欄のままにしてください"
                  }
                  value={validTo}
                  onValueChange={(value) => {
                    setValidTo(value);
                    if (validToError) setValidToError(undefined);
                    if (formError) setFormError(undefined);
                  }}
                  errorMessage={validToError}
                  disabled={isSubmitting}
                />

                <TextField
                  label={isEdit ? "変更の確認根拠（任意）" : "確認根拠（任意）"}
                  name="evidence"
                  placeholder={isEdit ? "変更登記簿を確認" : "履歴事項全部証明書・開設許可証を確認"}
                  value={evidence}
                  onValueChange={setEvidence}
                  disabled={isSubmitting}
                />

                {!isEdit ? (
                  <Select
                    label="初期システム利用状態"
                    name="usage_status"
                    items={USAGE_STATUS_OPTIONS}
                    value={usageStatus}
                    onValueChange={(value) => {
                      if (value === "not_started" || value === "active" || value === "suspended") {
                        setUsageStatus(value);
                      }
                    }}
                    disabled={isSubmitting}
                  />
                ) : null}
              </div>

              {isEdit && initialCorporation ? (
                <p {...stylex.props(s.metaGrid)}>
                  <span>
                    法人ID（テナントID）:{" "}
                    <code {...stylex.props(s.metaCode)}>{initialCorporation.id}</code>
                  </span>
                </p>
              ) : null}
            </div>
          </details>

          <div {...stylex.props(s.submitRow)}>
            <Link href={backHref} {...stylex.props(s.textLinkButton)}>
              キャンセル
            </Link>
            <Button type="submit" variant="filled" disabled={isSubmitting}>
              {isEdit
                ? isSubmitting
                  ? "保存中…"
                  : "基本情報を保存"
                : isSubmitting
                  ? "登録中…"
                  : "企業（法人・個人）を登録"}
            </Button>
          </div>
        </form>
      </div>
    );

  const editTabs: readonly TabItem[] =
    isEdit && initialCorporation
      ? [
          {
            value: "basic",
            label: "基本情報",
            content: basicFormContent,
          },
          {
            value: "history",
            label: "変更履歴・訂正",
            content:
              onLookupSnapshot && onChangeStatus && onCorrectHistory ? (
                <CorporationHistoryPanel
                  section="history"
                  corporation={initialCorporation}
                  activeCorporations={activeCorporations}
                  historyRecords={historyRecords}
                  isLoadingHistory={isLoadingHistory}
                  historyErrorMessage={historyErrorMessage}
                  snapshotParams={snapshotParams}
                  onLookupSnapshot={onLookupSnapshot}
                  snapshotCorporation={snapshotCorporation}
                  isLoadingSnapshot={isLoadingSnapshot}
                  snapshotErrorMessage={snapshotErrorMessage}
                  isChangingStatus={isChangingStatus}
                  statusErrorMessage={statusErrorMessage}
                  onChangeStatus={onChangeStatus}
                  isCorrectingHistory={isCorrectingHistory}
                  correctionErrorMessage={correctionErrorMessage}
                  onCorrectHistory={onCorrectHistory}
                />
              ) : (
                <p {...stylex.props(s.sectionDescription)}>履歴機能は利用できません。</p>
              ),
          },
          {
            value: "operations",
            label: "利用状態・解散/合併",
            content: (
              <div {...stylex.props(s.formStack)}>
                {initialCorporation.status === "active" && onChangeUsageStatus ? (
                  <div {...stylex.props(s.editPanel)}>
                    <div {...stylex.props(s.listHeaderRow)}>
                      <div {...stylex.props(s.sectionHeader)}>
                        <div {...stylex.props(s.corpTitleRow)}>
                          <h3 {...stylex.props(s.subSectionTitle)}>システム利用状態</h3>
                          <Badge tone={usageStatusTone(currentUsage)}>
                            利用: {usageStatusLabel(currentUsage)}
                          </Badge>
                        </div>
                        <p {...stylex.props(s.sectionDescription)}>
                          {isStoppingUsage
                            ? "現在システムを利用中です。利用を停止するとテナントとしての新規稼働を停止します。"
                            : "現在は参照専用（または利用停止）です。利用を開始すると本システムをテナントとして稼働できます。"}
                        </p>
                      </div>
                      <Button
                        variant="outlined"
                        disabled={isChangingUsageStatus}
                        onClick={() => setIsUsageDialogOpen(true)}
                      >
                        {isStoppingUsage ? "利用停止" : "利用開始"}
                      </Button>
                    </div>

                    <Dialog
                      open={isUsageDialogOpen}
                      onOpenChange={(open) => {
                        if (!isChangingUsageStatus) {
                          setIsUsageDialogOpen(open);
                        }
                      }}
                      title={
                        isStoppingUsage
                          ? "システム利用を停止しますか？"
                          : "システム利用を開始しますか？"
                      }
                      description={
                        isStoppingUsage
                          ? `「${initialCorporation.name}」のシステム利用状態を「利用停止」に変更します。`
                          : `「${initialCorporation.name}」のシステム利用状態を「利用中」に変更します。`
                      }
                      closeLabel="閉じる"
                      actions={
                        <>
                          <DialogCloseButton variant="text" disabled={isChangingUsageStatus}>
                            キャンセル
                          </DialogCloseButton>
                          <Button
                            variant="filled"
                            disabled={isChangingUsageStatus}
                            onClick={async () => {
                              const ok = await onChangeUsageStatus(
                                initialCorporation.id,
                                nextUsage,
                              );
                              if (ok) {
                                setIsUsageDialogOpen(false);
                              }
                            }}
                          >
                            {isChangingUsageStatus
                              ? "処理中…"
                              : isStoppingUsage
                                ? "利用を停止する"
                                : "利用を開始する"}
                          </Button>
                        </>
                      }
                    >
                      <p>
                        {isStoppingUsage
                          ? "利用停止へ切り替えると、この法人のシステム利用状態が「利用停止」になります。実行してもよろしいですか？"
                          : "利用開始へ切り替えると、この法人のシステム利用状態が「利用中」になります。実行してもよろしいですか？"}
                      </p>
                      {usageStatusErrorMessage ? (
                        <Alert tone="error" title="利用状態を変更できませんでした" role="alert">
                          <p>{usageStatusErrorMessage}</p>
                        </Alert>
                      ) : null}
                    </Dialog>
                  </div>
                ) : null}

                {initialCorporation.status === "active" &&
                onLookupSnapshot &&
                onChangeStatus &&
                onCorrectHistory ? (
                  <CorporationHistoryPanel
                    section="status"
                    corporation={initialCorporation}
                    activeCorporations={activeCorporations}
                    historyRecords={historyRecords}
                    isLoadingHistory={isLoadingHistory}
                    historyErrorMessage={historyErrorMessage}
                    snapshotParams={snapshotParams}
                    onLookupSnapshot={onLookupSnapshot}
                    snapshotCorporation={snapshotCorporation}
                    isLoadingSnapshot={isLoadingSnapshot}
                    snapshotErrorMessage={snapshotErrorMessage}
                    isChangingStatus={isChangingStatus}
                    statusErrorMessage={statusErrorMessage}
                    onChangeStatus={onChangeStatus}
                    isCorrectingHistory={isCorrectingHistory}
                    correctionErrorMessage={correctionErrorMessage}
                    onCorrectHistory={onCorrectHistory}
                  />
                ) : (
                  <Alert tone="info" title="状態変更は不要です">
                    <p>この法人はすでに解散または合併消滅済みです。</p>
                  </Alert>
                )}
              </div>
            ),
          },
        ]
      : [];

  return (
    <div data-vendor-console="" {...stylex.props(layout.page)}>
      <div {...stylex.props(layout.container)}>
        <VendorConsoleHeader
          title={pageTitle}
          activeSection="corporations"
          currentUser={currentUser}
          isLoggingOut={isLoggingOut}
          onLogout={onLogout}
        />

        <section aria-labelledby="corporation-form-heading" {...stylex.props(layout.panel)}>
          <div {...stylex.props(s.listHeaderRow)}>
            <div {...stylex.props(s.sectionHeader)}>
              {isEdit && initialCorporation ? (
                <div {...stylex.props(s.corpTitleRow)}>
                  <h2 id="corporation-form-heading" {...stylex.props(layout.panelHeading)}>
                    {initialCorporation.name}
                  </h2>
                  <Badge tone="neutral">{categoryLabel(initialCorporation.category)}</Badge>
                  <Badge tone={statusTone(initialCorporation.status)}>
                    {statusLabel(initialCorporation.status)}
                  </Badge>
                  <Badge tone={usageStatusTone(currentUsage)}>
                    利用: {usageStatusLabel(currentUsage)}
                  </Badge>
                </div>
              ) : (
                <p id="corporation-form-heading" {...stylex.props(s.sectionDescription)}>
                  薬局を開設する法人または個人開設者を登録します。1法人（または1個人開設者）＝1テナントとして管理されます。
                </p>
              )}
            </div>
            <Link href={backHref} {...stylex.props(s.outlinedLinkButton)}>
              法人一覧へ戻る
            </Link>
          </div>

          {isEdit && initialCorporation ? (
            <Tabs
              aria-label="企業管理セクション"
              defaultValue="basic"
              variant="primary"
              items={editTabs}
            />
          ) : (
            basicFormContent
          )}
        </section>
      </div>
    </div>
  );
}
