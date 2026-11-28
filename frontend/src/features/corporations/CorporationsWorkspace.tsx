"use client";

import * as stylex from "@stylexjs/stylex";
import Link from "next/link";
import type { AuthUser } from "@/features/auth/schemas";
import { VendorConsoleHeader } from "@/features/auth/VendorConsoleHeader";
import { vendorConsoleLayoutStyles as layout } from "@/features/auth/VendorConsoleLayout.styles";
import { Alert } from "@/shared/ui/alert/Alert";
import { Badge } from "@/shared/ui/badge/Badge";
import { Select, type SelectOption } from "@/shared/ui/select/Select";
import { Spinner } from "@/shared/ui/spinner/Spinner";
import { TextField } from "@/shared/ui/text-field/TextField";
import { corporationsWorkspaceStyles as s } from "./CorporationsWorkspace.styles";
import type {
  Corporation,
  CorporationCategory,
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
  { value: "active", label: "存続中" },
  { value: "dissolved", label: "解散" },
  { value: "merged_out", label: "合併消滅" },
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
}

/** Material Design 3 準拠の導入企業（法人・個人開設者）一覧ワークスペース。 */
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
                キーワード、開設主体区分、存続状態で絞り込み、各企業の詳細・編集・履歴管理画面へ移動できます。
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
            <div {...stylex.props(s.tableWrapper)}>
              <table {...stylex.props(s.table)}>
                <thead {...stylex.props(s.tableHead)}>
                  <tr>
                    <th scope="col" {...stylex.props(s.tableHeadCell)}>
                      法人名
                    </th>
                    <th scope="col" {...stylex.props(s.tableHeadCell)}>
                      代表者 / 開設者
                    </th>
                    <th scope="col" {...stylex.props(s.tableHeadCell)}>
                      所在地
                    </th>
                    <th scope="col" {...stylex.props(s.tableHeadCell)}>
                      存続状態
                    </th>
                    <th scope="col" {...stylex.props(s.tableHeadCell)}>
                      利用状態
                    </th>
                    <th scope="col" {...stylex.props(s.tableHeadCell)}>
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody {...stylex.props(s.tableBody)}>
                  {corporations.map((item) => (
                    <tr key={item.id} {...stylex.props(s.tableRow)}>
                      <th scope="row" {...stylex.props(s.tableRowHeader)}>
                        <div {...stylex.props(s.nameCellContent)}>
                          <span {...stylex.props(s.corpName)}>{item.name}</span>
                          <Badge tone="neutral">{categoryLabel(item.category)}</Badge>
                        </div>
                      </th>
                      <td {...stylex.props(s.tableCell)}>
                        <span {...stylex.props(s.mobileCellLabel)}>
                          {item.category === "individual" ? "開設者:" : "代表者:"}
                        </span>
                        <span>{item.representative_name || "未設定"}</span>
                      </td>
                      <td {...stylex.props(s.tableCell)}>
                        <span {...stylex.props(s.mobileCellLabel)}>所在地:</span>
                        <span>{item.address || "未設定"}</span>
                      </td>
                      <td {...stylex.props(s.tableCell)}>
                        <span {...stylex.props(s.mobileCellLabel)}>存続状態:</span>
                        <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
                      </td>
                      <td {...stylex.props(s.tableCell)}>
                        <span {...stylex.props(s.mobileCellLabel)}>利用状態:</span>
                        <Badge tone={usageStatusTone(item.usage_status ?? "not_started")}>
                          利用: {usageStatusLabel(item.usage_status ?? "not_started")}
                        </Badge>
                      </td>
                      <td {...stylex.props(s.tableCell)}>
                        <Link
                          href={`/vendor/corporations/${item.id}/edit`}
                          {...stylex.props(s.outlinedLinkButton)}
                        >
                          {item.status === "active" ? "編集・管理" : "履歴を確認"}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
