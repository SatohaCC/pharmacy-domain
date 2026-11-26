"use client";

import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import type { AuthUser } from "@/features/auth/schemas";
import { VendorConsoleHeader } from "@/features/auth/VendorConsoleHeader";
import type { ApiUserFacingError } from "@/shared/lib/api/apiClient";
import { Alert } from "@/shared/ui/alert/Alert";
import { Badge } from "@/shared/ui/badge/Badge";
import { Button } from "@/shared/ui/button/Button";
import { RadioGroup, type RadioOption } from "@/shared/ui/radio-group/RadioGroup";
import { Select, type SelectOption } from "@/shared/ui/select/Select";
import { Spinner } from "@/shared/ui/spinner/Spinner";
import { TextField } from "@/shared/ui/text-field/TextField";
import { corporationsWorkspaceStyles as s } from "./CorporationsWorkspace.styles";
import type {
  Corporation,
  CorporationCategory,
  CorporationListFilter,
  CorporationStatus,
} from "./schemas";

const CATEGORY_RADIO_ITEMS: readonly RadioOption[] = [
  { value: "corporation", label: "法人（株式会社・有限会社等）" },
  { value: "individual", label: "個人開設者" },
];

const CATEGORY_FILTER_OPTIONS: readonly SelectOption[] = [
  { value: "all", label: "すべての区分" },
  { value: "corporation", label: "法人" },
  { value: "individual", label: "個人開設者" },
];

const STATUS_FILTER_OPTIONS: readonly SelectOption[] = [
  { value: "all", label: "すべての存続状態" },
  { value: "active", label: "存続（active）" },
  { value: "dissolved", label: "解散（dissolved）" },
  { value: "merged_out", label: "合併消滅（merged_out）" },
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

export interface CorporationsWorkspaceProps {
  currentUser: AuthUser;
  corporations: readonly Corporation[];
  totalCount: number;
  filter: CorporationListFilter;
  onFilterChange: (next: CorporationListFilter) => void;
  isLoadingCorporations: boolean;
  corporationsErrorMessage: string | null;
  isCreatingCorporation: boolean;
  createErrorMessage: string | null;
  createUserFacingError: ApiUserFacingError | null;
  lastCreatedCorporation: Corporation | null;
  onDismissCreatedBanner: () => void;
  onCreateCorporation: (input: {
    category: CorporationCategory;
    name: string;
    corporate_number?: string | null;
    address?: string;
    valid_from?: string | null;
    evidence?: string | null;
  }) => Promise<boolean>;
  isUpdatingCorporation: boolean;
  updateErrorMessage: string | null;
  updateUserFacingError: ApiUserFacingError | null;
  lastUpdatedCorporation: Corporation | null;
  onDismissUpdatedBanner: () => void;
  onUpdateCorporation: (
    corporationId: string,
    input: {
      name?: string | null;
      corporate_number?: string | null;
      address?: string | null;
      valid_from?: string | null;
      evidence?: string | null;
    },
  ) => Promise<boolean>;
  isLoggingOut: boolean;
  onLogout: () => void;
}

/** Material Design 3 準拠の導入企業（法人・個人開設者）管理ワークスペース。 */
export function CorporationsWorkspace({
  currentUser,
  corporations,
  totalCount,
  filter,
  onFilterChange,
  isLoadingCorporations,
  corporationsErrorMessage,
  isCreatingCorporation,
  createErrorMessage,
  createUserFacingError,
  lastCreatedCorporation,
  onDismissCreatedBanner,
  onCreateCorporation,
  isUpdatingCorporation,
  updateErrorMessage,
  updateUserFacingError,
  lastUpdatedCorporation,
  onDismissUpdatedBanner,
  onUpdateCorporation,
  isLoggingOut,
  onLogout,
}: CorporationsWorkspaceProps) {
  const [category, setCategory] = useState<CorporationCategory>("corporation");
  const [name, setName] = useState("");
  const [corporateNumber, setCorporateNumber] = useState("");
  const [address, setAddress] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [evidence, setEvidence] = useState("");

  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [corporateNumberError, setCorporateNumberError] = useState<string | undefined>(undefined);

  const [editingCorpId, setEditingCorpId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCorporateNumber, setEditCorporateNumber] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editValidFrom, setEditValidFrom] = useState("");
  const [editEvidence, setEditEvidence] = useState("");
  const [editNameError, setEditNameError] = useState<string | undefined>(undefined);
  const [editCorporateNumberError, setEditCorporateNumberError] = useState<string | undefined>(
    undefined,
  );
  const [editFormError, setEditFormError] = useState<string | undefined>(undefined);

  async function handleCreateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedNumber = corporateNumber.trim();
    const trimmedAddress = address.trim();
    const trimmedValidFrom = validFrom.trim();
    const trimmedEvidence = evidence.trim();

    const nextNameError = trimmedName
      ? undefined
      : "法人名（または個人開設者の氏名・屋号）を入力してください。";
    const nextNumberError = validateCorporateNumber(category, trimmedNumber);

    setNameError(nextNameError);
    setCorporateNumberError(nextNumberError);

    if (nextNameError || nextNumberError) {
      return;
    }

    const created = await onCreateCorporation({
      category,
      name: trimmedName,
      corporate_number: category === "corporation" && trimmedNumber ? trimmedNumber : null,
      address: trimmedAddress,
      valid_from: trimmedValidFrom || null,
      evidence: trimmedEvidence || null,
    });
    if (created) {
      setName("");
      setCorporateNumber("");
      setAddress("");
      setValidFrom("");
      setEvidence("");
    }
  }

  function startEditing(item: Corporation) {
    setEditingCorpId(item.id);
    setEditName(item.name);
    setEditCorporateNumber(item.corporate_number ?? "");
    setEditAddress(item.address);
    setEditValidFrom("");
    setEditEvidence("");
    setEditNameError(undefined);
    setEditCorporateNumberError(undefined);
    setEditFormError(undefined);
  }

  async function handleEditSubmit(event: React.FormEvent<HTMLFormElement>, item: Corporation) {
    event.preventDefault();
    const trimmedName = editName.trim();
    const trimmedNumber = editCorporateNumber.trim();
    const trimmedAddress = editAddress.trim();
    const trimmedValidFrom = editValidFrom.trim();
    const trimmedEvidence = editEvidence.trim();

    const nextNameError = trimmedName ? undefined : "変更後の名称を入力してください。";
    const nextNumberError = validateCorporateNumber(item.category, trimmedNumber);

    setEditNameError(nextNameError);
    setEditCorporateNumberError(nextNumberError);

    if (nextNameError || nextNumberError) {
      return;
    }

    const payload: {
      name?: string | null;
      corporate_number?: string | null;
      address?: string | null;
      valid_from?: string | null;
      evidence?: string | null;
    } = {};

    if (trimmedName !== item.name) {
      payload.name = trimmedName;
    }
    if (item.category === "corporation" && trimmedNumber !== (item.corporate_number ?? "")) {
      payload.corporate_number = trimmedNumber || null;
    }
    if (trimmedAddress !== item.address) {
      payload.address = trimmedAddress;
    }

    if (Object.keys(payload).length === 0) {
      setEditFormError(
        "変更された項目がありません。名称・法人番号・所在地のいずれかを変更してください。",
      );
      return;
    }

    if (trimmedValidFrom) {
      payload.valid_from = trimmedValidFrom;
    }
    if (trimmedEvidence) {
      payload.evidence = trimmedEvidence;
    }

    setEditFormError(undefined);
    const updated = await onUpdateCorporation(item.id, payload);
    if (updated) {
      setEditingCorpId(null);
    }
  }

  return (
    <div {...stylex.props(s.page)}>
      <div {...stylex.props(s.container)}>
        <VendorConsoleHeader
          title="導入企業（法人・個人開設者）管理"
          activeSection="corporations"
          currentUser={currentUser}
          isLoggingOut={isLoggingOut}
          onLogout={onLogout}
        />

        <section aria-labelledby="create-corporation-heading" {...stylex.props(s.card)}>
          <div {...stylex.props(s.sectionHeader)}>
            <h2 id="create-corporation-heading" {...stylex.props(s.sectionTitle)}>
              新規企業（法人・個人開設者）の登録
            </h2>
            <p {...stylex.props(s.sectionDescription)}>
              薬局を開設する法人または個人開設者を登録します。1法人（または1個人開設者）＝1テナントとして管理されます。
            </p>
          </div>

          {lastCreatedCorporation ? (
            <Alert
              tone="success"
              title="企業（テナント）を登録しました"
              onDismiss={onDismissCreatedBanner}
              dismissLabel="登録完了メッセージを閉じる"
            >
              <p>
                {lastCreatedCorporation.name}（区分:{" "}
                {categoryLabel(lastCreatedCorporation.category)} / テナントID:{" "}
                <code {...stylex.props(s.metaCode)}>{lastCreatedCorporation.id}</code>
                ）を登録しました。
              </p>
            </Alert>
          ) : null}

          {createErrorMessage ? (
            <Alert
              tone="error"
              title={createUserFacingError?.title ?? "企業を登録できませんでした"}
              role="alert"
            >
              <p>{createUserFacingError?.reason ?? createErrorMessage}</p>
              {createUserFacingError?.how_to_fix ? <p>{createUserFacingError.how_to_fix}</p> : null}
            </Alert>
          ) : null}

          <form
            aria-labelledby="create-corporation-heading"
            onSubmit={handleCreateSubmit}
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
                if (value === "corporation" || value === "individual") {
                  setCategory(value);
                  if (value === "individual") {
                    setCorporateNumber("");
                    setCorporateNumberError(undefined);
                  }
                }
              }}
              disabled={isCreatingCorporation}
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
                }}
                errorMessage={nameError}
                required
                disabled={isCreatingCorporation}
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
                }}
                errorMessage={corporateNumberError}
                disabled={category === "individual" || isCreatingCorporation}
              />
            </div>

            <div {...stylex.props(s.formGrid)}>
              <TextField
                label="本店または主たる事務所の所在地"
                name="address"
                autoComplete="street-address"
                placeholder="東京都新宿区1-2-3"
                value={address}
                onValueChange={setAddress}
                disabled={isCreatingCorporation}
              />

              <TextField
                label="有効開始日（任意）"
                name="valid_from"
                type="date"
                description="設立日または確認できた基準日"
                value={validFrom}
                onValueChange={setValidFrom}
                disabled={isCreatingCorporation}
              />

              <TextField
                label="確認根拠（任意）"
                name="evidence"
                placeholder="履歴事項全部証明書・開設許可証を確認"
                value={evidence}
                onValueChange={setEvidence}
                disabled={isCreatingCorporation}
              />
            </div>

            <div {...stylex.props(s.submitRow)}>
              <Button type="submit" variant="filled" disabled={isCreatingCorporation}>
                {isCreatingCorporation ? "登録中…" : "企業（法人・個人）を登録"}
              </Button>
            </div>
          </form>
        </section>

        <section aria-labelledby="corporation-list-heading" {...stylex.props(s.card)}>
          <div {...stylex.props(s.sectionHeader)}>
            <h2 id="corporation-list-heading" {...stylex.props(s.sectionTitle)}>
              登録済み企業一覧（{totalCount}件）
            </h2>
            <p {...stylex.props(s.sectionDescription)}>
              キーワード、開設主体区分、存続状態で絞り込み、各企業の基本情報を確認・更新できます。
            </p>
          </div>

          {lastUpdatedCorporation ? (
            <Alert
              tone="success"
              title="企業の基本情報を更新しました"
              onDismiss={onDismissUpdatedBanner}
              dismissLabel="更新完了メッセージを閉じる"
            >
              <p>{lastUpdatedCorporation.name} の基本情報を保存しました。</p>
            </Alert>
          ) : null}

          {updateErrorMessage ? (
            <Alert
              tone="error"
              title={updateUserFacingError?.title ?? "基本情報を更新できませんでした"}
              role="alert"
            >
              <p>{updateUserFacingError?.reason ?? updateErrorMessage}</p>
              {updateUserFacingError?.how_to_fix ? <p>{updateUserFacingError.how_to_fix}</p> : null}
            </Alert>
          ) : null}

          <search aria-label="登録済み企業の検索と絞り込み" {...stylex.props(s.searchGrid)}>
            <TextField
              label="キーワード検索"
              name="search_q"
              type="search"
              autoCorrect="off"
              spellCheck={false}
              placeholder="法人名・所在地・法人番号で検索"
              value={filter.q ?? ""}
              onValueChange={(value) => {
                onFilterChange({ ...filter, q: value });
              }}
            />

            <Select
              label="区分フィルタ"
              name="filter_category"
              items={CATEGORY_FILTER_OPTIONS}
              value={filter.category ?? "all"}
              onValueChange={(value) => {
                onFilterChange({
                  ...filter,
                  category: value === "corporation" || value === "individual" ? value : undefined,
                });
              }}
            />

            <Select
              label="存続状態フィルタ"
              name="filter_status"
              items={STATUS_FILTER_OPTIONS}
              value={filter.status ?? "all"}
              onValueChange={(value) => {
                onFilterChange({
                  ...filter,
                  status:
                    value === "active" || value === "dissolved" || value === "merged_out"
                      ? value
                      : undefined,
                });
              }}
            />
          </search>

          {isLoadingCorporations ? (
            <Spinner label="企業一覧を読み込み中…" showLabel />
          ) : corporationsErrorMessage ? (
            <Alert tone="error" title="企業一覧を取得できませんでした" role="alert">
              {corporationsErrorMessage}
            </Alert>
          ) : corporations.length === 0 ? (
            <p {...stylex.props(s.emptyState)}>条件に一致する企業は登録されていません。</p>
          ) : (
            <ul {...stylex.props(s.corpList)}>
              {corporations.map((item) => {
                const isEditing = editingCorpId === item.id;
                const editHeadingId = `edit-corporation-heading-${item.id}`;
                return (
                  <li key={item.id} {...stylex.props(s.corpItem)}>
                    <div {...stylex.props(s.corpItemHeader)}>
                      <div {...stylex.props(s.corpMainInfo)}>
                        <div {...stylex.props(s.corpTitleRow)}>
                          <p {...stylex.props(s.corpName)}>{item.name}</p>
                          <Badge tone="neutral">{categoryLabel(item.category)}</Badge>
                          <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
                        </div>
                        <p {...stylex.props(s.metaGrid)}>
                          <span>
                            法人番号:{" "}
                            <code {...stylex.props(s.metaCode)}>
                              {item.corporate_number ?? "未設定"}
                            </code>
                          </span>
                          <span>所在地: {item.address || "未設定"}</span>
                          <span>
                            テナントID: <code {...stylex.props(s.metaCode)}>{item.id}</code>
                          </span>
                        </p>
                      </div>

                      {item.status === "active" ? (
                        <Button
                          variant={isEditing ? "tonal" : "outlined"}
                          size="sm"
                          onClick={() => {
                            if (isEditing) {
                              setEditingCorpId(null);
                            } else {
                              startEditing(item);
                            }
                          }}
                        >
                          {isEditing ? "編集を閉じる" : "基本情報を編集"}
                        </Button>
                      ) : null}
                    </div>

                    {isEditing ? (
                      <form
                        aria-labelledby={editHeadingId}
                        onSubmit={(e) => void handleEditSubmit(e, item)}
                        noValidate
                        {...stylex.props(s.editPanel)}
                      >
                        <h3 id={editHeadingId} {...stylex.props(s.editTitle)}>
                          基本情報の編集: {item.name}
                        </h3>

                        {editFormError ? (
                          <Alert tone="error" title="変更内容を確認してください" role="alert">
                            <p>{editFormError}</p>
                          </Alert>
                        ) : null}

                        <div {...stylex.props(s.formGrid)}>
                          <TextField
                            label="変更後の名称"
                            name="edit_name"
                            value={editName}
                            onValueChange={(value) => {
                              setEditName(value);
                              if (editNameError) setEditNameError(undefined);
                              if (editFormError) setEditFormError(undefined);
                            }}
                            errorMessage={editNameError}
                            required
                            disabled={isUpdatingCorporation}
                          />

                          <TextField
                            label="変更後の法人番号（13桁）"
                            name="edit_corporate_number"
                            inputMode="numeric"
                            autoCorrect="off"
                            autoCapitalize="none"
                            spellCheck={false}
                            maxLength={13}
                            value={editCorporateNumber}
                            onValueChange={(value) => {
                              setEditCorporateNumber(value);
                              if (editCorporateNumberError) setEditCorporateNumberError(undefined);
                              if (editFormError) setEditFormError(undefined);
                            }}
                            errorMessage={editCorporateNumberError}
                            disabled={item.category === "individual" || isUpdatingCorporation}
                          />
                        </div>

                        <div {...stylex.props(s.formGrid)}>
                          <TextField
                            label="変更後の所在地"
                            name="edit_address"
                            value={editAddress}
                            onValueChange={(value) => {
                              setEditAddress(value);
                              if (editFormError) setEditFormError(undefined);
                            }}
                            disabled={isUpdatingCorporation}
                          />

                          <TextField
                            label="変更の有効開始日（任意）"
                            name="edit_valid_from"
                            type="date"
                            value={editValidFrom}
                            onValueChange={setEditValidFrom}
                            disabled={isUpdatingCorporation}
                          />

                          <TextField
                            label="変更の確認根拠（任意）"
                            name="edit_evidence"
                            placeholder="変更登記簿を確認"
                            value={editEvidence}
                            onValueChange={setEditEvidence}
                            disabled={isUpdatingCorporation}
                          />
                        </div>

                        <div {...stylex.props(s.submitRow)}>
                          <Button
                            variant="text"
                            onClick={() => setEditingCorpId(null)}
                            disabled={isUpdatingCorporation}
                          >
                            キャンセル
                          </Button>
                          <Button type="submit" variant="filled" disabled={isUpdatingCorporation}>
                            {isUpdatingCorporation ? "保存中…" : "基本情報を保存"}
                          </Button>
                        </div>
                      </form>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
