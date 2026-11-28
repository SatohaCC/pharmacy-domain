"use client";

import * as stylex from "@stylexjs/stylex";
import Link from "next/link";
import type { AuthUser } from "@/features/auth/schemas";
import { VendorConsoleHeader } from "@/features/auth/VendorConsoleHeader";
import { vendorConsoleLayoutStyles as layout } from "@/features/auth/VendorConsoleLayout.styles";
import { Alert } from "@/shared/ui/alert/Alert";
import { Badge } from "@/shared/ui/badge/Badge";
import { Button } from "@/shared/ui/button/Button";
import { Select, type SelectOption } from "@/shared/ui/select/Select";
import { Spinner } from "@/shared/ui/spinner/Spinner";
import { TextField } from "@/shared/ui/text-field/TextField";
import { CorporationHistoryPanel } from "./CorporationHistoryPanel";
import { corporationsWorkspaceStyles as s } from "./CorporationsWorkspace.styles";
import type {
  Corporation,
  CorporationCategory,
  CorporationHistoryRecord,
  CorporationListFilter,
  CorporationStatus,
  CorporationUsageStatus,
} from "./schemas";

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

const USAGE_STATUS_OPTIONS: readonly SelectOption[] = [
  { value: "not_started", label: "未利用（参照専用）" },
  { value: "active", label: "利用中" },
  { value: "suspended", label: "利用停止" },
];

const USAGE_STATUS_FILTER_OPTIONS: readonly SelectOption[] = [
  { value: "all", label: "すべての利用状態" },
  ...USAGE_STATUS_OPTIONS,
];

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

export interface CorporationsWorkspaceProps {
  currentUser: AuthUser;
  corporations: readonly Corporation[];
  totalCount: number;
  filter: CorporationListFilter;
  onFilterChange: (next: CorporationListFilter) => void;
  isLoadingCorporations: boolean;
  isFetchingCorporations: boolean;
  corporationsErrorMessage: string | null;
  notice?: "created" | "updated" | null;
  onDismissNotice?: () => void;
  isLoggingOut: boolean;
  onLogout: () => void;
  selectedHistoryCorpId?: string | null;
  onSelectHistoryCorp?: (corporationId: string | null) => void;
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
  isChangingUsageStatus?: boolean;
  onChangeUsageStatus?: (
    corporationId: string,
    usageStatus: CorporationUsageStatus,
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
}

/** Material Design 3 準拠の導入企業（法人・個人開設者）一覧・管理ワークスペース。 */
export function CorporationsWorkspace({
  currentUser,
  corporations,
  totalCount,
  filter,
  onFilterChange,
  isLoadingCorporations,
  isFetchingCorporations,
  corporationsErrorMessage,
  notice = null,
  onDismissNotice,
  isLoggingOut,
  onLogout,
  selectedHistoryCorpId = null,
  onSelectHistoryCorp,
  activeCorporations,
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
  isChangingUsageStatus = false,
  onChangeUsageStatus,
  isCorrectingHistory = false,
  correctionErrorMessage = null,
  onCorrectHistory,
}: CorporationsWorkspaceProps) {
  return (
    <div data-vendor-console="" {...stylex.props(layout.page)}>
      <div {...stylex.props(layout.container)}>
        <VendorConsoleHeader
          title="導入企業（法人・個人開設者）管理"
          activeSection="corporations"
          currentUser={currentUser}
          isLoggingOut={isLoggingOut}
          onLogout={onLogout}
        />

        <section aria-labelledby="corporation-list-heading" {...stylex.props(layout.panel)}>
          <div {...stylex.props(s.listHeaderRow)}>
            <div {...stylex.props(s.sectionHeader)}>
              <h2 id="corporation-list-heading" {...stylex.props(layout.panelHeading)}>
                登録済み企業一覧（{totalCount}件）
              </h2>
              <p {...stylex.props(s.sectionDescription)}>
                キーワード、開設主体区分、存続状態で絞り込み、各企業の基本情報の編集・履歴確認ができます。
              </p>
              <p role="status" {...stylex.props(s.sectionDescription, s.refreshStatus)}>
                {isFetchingCorporations && !isLoadingCorporations ? "企業一覧を更新中…" : null}
              </p>
            </div>
            <Link href="/vendor/corporations/new" {...stylex.props(s.primaryLinkButton)}>
              新規企業を登録
            </Link>
          </div>

          {notice === "created" ? (
            <Alert
              tone="success"
              title="企業（テナント）を登録しました"
              onDismiss={onDismissNotice}
              dismissLabel="登録完了メッセージを閉じる"
            >
              <p>新しい企業を登録しました。</p>
            </Alert>
          ) : null}

          {notice === "updated" ? (
            <Alert
              tone="success"
              title="企業の基本情報を更新しました"
              onDismiss={onDismissNotice}
              dismissLabel="更新完了メッセージを閉じる"
            >
              <p>企業の基本情報を保存しました。</p>
            </Alert>
          ) : null}

          <search aria-label="登録済み企業の検索と絞り込み" {...stylex.props(s.searchGrid)}>
            <TextField
              label="キーワード検索"
              name="search_q"
              type="search"
              autoCorrect="off"
              spellCheck={false}
              placeholder="法人名・代表者名・所在地・法人番号で検索"
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

            <Select
              label="システム利用状態"
              name="filter_usage_status"
              items={USAGE_STATUS_FILTER_OPTIONS}
              value={filter.usage_status ?? "all"}
              onValueChange={(value) => {
                onFilterChange({
                  ...filter,
                  usage_status:
                    value === "not_started" || value === "active" || value === "suspended"
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
              {corporations.map((item) => (
                <li key={item.id} {...stylex.props(s.corpItem)}>
                  <div {...stylex.props(s.corpItemHeader)}>
                    <div {...stylex.props(s.corpMainInfo)}>
                      <div {...stylex.props(s.corpTitleRow)}>
                        <p {...stylex.props(s.corpName)}>{item.name}</p>
                        <Badge tone="neutral">{categoryLabel(item.category)}</Badge>
                        <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
                        <Badge tone={usageStatusTone(item.usage_status ?? "not_started")}>
                          利用: {usageStatusLabel(item.usage_status ?? "not_started")}
                        </Badge>
                      </div>
                      <p {...stylex.props(s.metaGrid)}>
                        <span>
                          {item.category === "individual" ? "開設者" : "代表者"}:{" "}
                          {item.representative_name || "未設定"}
                        </span>
                        <span>
                          法人番号:{" "}
                          <code {...stylex.props(s.metaCode)}>
                            {item.corporate_number ?? "未設定"}
                          </code>
                        </span>
                        <span>所在地: {item.address || "未設定"}</span>
                        <span>
                          有効期間: {item.valid_from ?? "未設定"} 〜 {item.valid_to ?? "終了未定"}
                        </span>
                        <span>
                          テナントID: <code {...stylex.props(s.metaCode)}>{item.id}</code>
                        </span>
                      </p>
                    </div>

                    <div {...stylex.props(s.actionRow)}>
                      {item.status === "active" && onChangeUsageStatus ? (
                        <Button
                          variant="outlined"
                          size="sm"
                          disabled={isChangingUsageStatus}
                          onClick={() => {
                            const nextUsage =
                              (item.usage_status ?? "not_started") === "active"
                                ? "suspended"
                                : "active";
                            void onChangeUsageStatus(item.id, nextUsage);
                          }}
                        >
                          {(item.usage_status ?? "not_started") === "active"
                            ? "利用停止"
                            : "利用開始"}
                        </Button>
                      ) : null}
                      {onSelectHistoryCorp ? (
                        <Button
                          variant={selectedHistoryCorpId === item.id ? "tonal" : "outlined"}
                          size="sm"
                          onClick={() => {
                            onSelectHistoryCorp(selectedHistoryCorpId === item.id ? null : item.id);
                          }}
                        >
                          {selectedHistoryCorpId === item.id ? "履歴を閉じる" : "履歴・状態管理"}
                        </Button>
                      ) : null}
                      {item.status === "active" ? (
                        <Link
                          href={`/vendor/corporations/${item.id}/edit`}
                          {...stylex.props(s.outlinedLinkButton)}
                        >
                          基本情報を編集
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  {selectedHistoryCorpId === item.id &&
                  onLookupSnapshot &&
                  onChangeStatus &&
                  onCorrectHistory ? (
                    <CorporationHistoryPanel
                      corporation={item}
                      activeCorporations={
                        activeCorporations ?? corporations.filter((c) => c.status === "active")
                      }
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
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
