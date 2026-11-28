"use client";

import * as stylex from "@stylexjs/stylex";
import Link from "next/link";
import { useState } from "react";
import type { AuthUser } from "@/features/auth/schemas";
import { VendorConsoleHeader } from "@/features/auth/VendorConsoleHeader";
import { vendorConsoleLayoutStyles as layout } from "@/features/auth/VendorConsoleLayout.styles";
import type { ApiUserFacingError } from "@/shared/lib/api/apiClient";
import { Alert } from "@/shared/ui/alert/Alert";
import { Button } from "@/shared/ui/button/Button";
import { RadioGroup, type RadioOption } from "@/shared/ui/radio-group/RadioGroup";
import { Select, type SelectOption } from "@/shared/ui/select/Select";
import { TextField } from "@/shared/ui/text-field/TextField";
import { corporationsWorkspaceStyles as s } from "./CorporationsWorkspace.styles";
import type { Corporation, CorporationCategory, CorporationUsageStatus } from "./schemas";

const CATEGORY_RADIO_ITEMS: readonly RadioOption[] = [
  { value: "corporation", label: "法人（株式会社・有限会社等）" },
  { value: "individual", label: "個人開設者" },
];

const USAGE_STATUS_OPTIONS: readonly SelectOption[] = [
  { value: "not_started", label: "未利用（参照専用）" },
  { value: "active", label: "利用中" },
  { value: "suspended", label: "利用停止" },
];

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
  isLoggingOut: boolean;
  onLogout: () => void;
  backHref?: string;
}

/** 企業の登録・基本情報編集を共通で扱うフォーム画面。 */
export function CorporationFormPage({
  mode,
  currentUser,
  initialCorporation,
  isSubmitting,
  submitErrorMessage,
  submitUserFacingError,
  onCreateCorporation,
  onUpdateCorporation,
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
    ? "導入企業（法人・個人開設者）の基本情報編集"
    : "新規企業（法人・個人開設者）の登録";
  const panelHeading = isEdit
    ? `基本情報の編集: ${initialCorporation?.name ?? ""}`
    : "新規企業（法人・個人開設者）の登録";
  const panelDescription = isEdit
    ? "変更された項目のみを保存します。変更の有効開始日や根拠を記録できます。"
    : "薬局を開設する法人または個人開設者を登録します。1法人（または1個人開設者）＝1テナントとして管理されます。";

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
              <h2 id="corporation-form-heading" {...stylex.props(layout.panelHeading)}>
                {panelHeading}
              </h2>
              <p {...stylex.props(s.sectionDescription)}>{panelDescription}</p>
            </div>
            <Link href={backHref} {...stylex.props(s.outlinedLinkButton)}>
              法人一覧へ戻る
            </Link>
          </div>

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
            aria-labelledby="corporation-form-heading"
            onSubmit={(e) => void handleSubmit(e)}
            noValidate
            {...stylex.props(s.formStack)}
          >
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
            </div>

            <div {...stylex.props(s.formGrid)}>
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
        </section>
      </div>
    </div>
  );
}
