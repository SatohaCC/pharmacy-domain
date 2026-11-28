import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/features/auth/schemas";
import { CorporationsWorkspace } from "./CorporationsWorkspace";
import type { Corporation } from "./schemas";

const vendorMember: AuthUser = {
  id: "member-1",
  email: "member@vendor.example.com",
  display_name: "運用 太郎",
  affiliation_type: "vendor",
  tenant_id: null,
  roles: ["vendor_member"],
  status: "active",
  created_at: "2026-11-26T00:00:00Z",
  updated_at: "2026-11-26T00:00:00Z",
};

const sampleCorporation: Corporation = {
  id: "corp-1",
  category: "corporation",
  name: "株式会社さくら薬局",
  representative_name: "佐藤 一郎",
  corporate_number: "1234567890123",
  address: "東京都新宿区1-2-3",
  status: "active",
  created_at: "2026-11-26T00:00:00Z",
  updated_at: "2026-11-26T00:00:00Z",
};

describe("CorporationsWorkspace", () => {
  it("一覧から登録画面・編集画面への遷移リンクと完了通知を表示できる", async () => {
    const user = userEvent.setup();
    const onDismissNotice = vi.fn();

    render(
      <CorporationsWorkspace
        currentUser={vendorMember}
        corporations={[sampleCorporation]}
        totalCount={1}
        filter={{}}
        onFilterChange={vi.fn()}
        isLoadingCorporations={false}
        isFetchingCorporations={false}
        corporationsErrorMessage={null}
        notice="created"
        onDismissNotice={onDismissNotice}
        isLoggingOut={false}
        onLogout={vi.fn()}
      />,
    );

    expect(screen.getByRole("link", { name: "新規企業を登録" })).toHaveAttribute(
      "href",
      "/vendor/corporations/new",
    );
    expect(screen.getByRole("link", { name: "基本情報を編集" })).toHaveAttribute(
      "href",
      "/vendor/corporations/corp-1/edit",
    );
    expect(screen.getByText("企業（テナント）を登録しました")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "登録完了メッセージを閉じる" }));
    expect(onDismissNotice).toHaveBeenCalledTimes(1);
  });

  it("履歴・状態管理パネルで合併・時点照会・履歴訂正を実行できる", async () => {
    const user = userEvent.setup();
    const survivingCorporation: Corporation = {
      ...sampleCorporation,
      id: "corp-2",
      name: "株式会社わかば薬局",
      representative_name: "鈴木 花子",
      corporate_number: "9999999999999",
    };
    const onSelectHistoryCorp = vi.fn();
    const onLookupSnapshot = vi.fn();
    const onChangeStatus = vi.fn().mockResolvedValue(true);
    const onCorrectHistory = vi.fn().mockResolvedValue(true);

    render(
      <CorporationsWorkspace
        currentUser={vendorMember}
        corporations={[sampleCorporation, survivingCorporation]}
        totalCount={2}
        filter={{}}
        onFilterChange={vi.fn()}
        isLoadingCorporations={false}
        isFetchingCorporations={false}
        corporationsErrorMessage={null}
        isLoggingOut={false}
        onLogout={vi.fn()}
        selectedHistoryCorpId="corp-1"
        onSelectHistoryCorp={onSelectHistoryCorp}
        historyRecords={[
          {
            corporation: sampleCorporation,
            valid_from: "2026-01-01",
            valid_to: null,
            recorded_at: "2026-11-26T00:00:00+09:00",
            kind: "registration",
            evidence: "設立登記",
            surviving_corporation_id: null,
            recorded_by: "vendor-admin-1",
          },
        ]}
        onLookupSnapshot={onLookupSnapshot}
        onChangeStatus={onChangeStatus}
        onCorrectHistory={onCorrectHistory}
      />,
    );

    expect(screen.getByText(/変更者: vendor-admin-1/)).toBeInTheDocument();

    // 合併先を指定して merged_out を送信
    await user.click(screen.getByRole("combobox", { name: "変更後の状態" }));
    await user.click(screen.getByRole("option", { name: "吸収合併で消滅 (merged_out)" }));
    await user.click(screen.getByRole("combobox", { name: "合併先の存続法人" }));
    await user.click(screen.getByRole("option", { name: "株式会社わかば薬局（代表: 鈴木 花子）" }));
    await user.type(screen.getByLabelText("効力日"), "2026-12-01");
    await user.click(screen.getByRole("button", { name: "ステータスを変更" }));
    expect(onChangeStatus).toHaveBeenCalledWith("corp-1", {
      status: "merged_out",
      effective_date: "2026-12-01",
      surviving_corporation_id: "corp-2",
      evidence: undefined,
    });

    // 時点照会
    await user.type(screen.getByLabelText("業務時点日 (as_of)"), "2026-06-01");
    await user.click(screen.getByRole("button", { name: "時点照会" }));
    expect(onLookupSnapshot).toHaveBeenCalledWith({
      as_of: "2026-06-01",
      recorded_as_of: undefined,
    });

    // タイムラインの「この記録を訂正」から法人番号・所在地をクリアして履歴訂正を送信
    await user.click(screen.getByRole("button", { name: "この記録を訂正" }));
    await user.clear(screen.getByLabelText("訂正後の法人番号"));
    await user.clear(screen.getByLabelText("訂正後の所在地"));
    await user.type(screen.getByLabelText(/訂正の根拠/), "登記簿修正");
    await user.click(screen.getByRole("button", { name: "履歴を訂正" }));
    expect(onCorrectHistory).toHaveBeenCalledWith("corp-1", {
      as_of: "2026-01-01",
      corporate_number: null,
      address: "",
      evidence: "登記簿修正",
    });
  });

  it("システム利用状態（初期値 not_started・フィルタ・利用開始切替）を操作できる", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    const onChangeUsageStatus = vi.fn().mockResolvedValue(true);

    render(
      <CorporationsWorkspace
        currentUser={vendorMember}
        corporations={[{ ...sampleCorporation, usage_status: "not_started" }]}
        totalCount={1}
        filter={{}}
        onFilterChange={onFilterChange}
        isLoadingCorporations={false}
        isFetchingCorporations={false}
        corporationsErrorMessage={null}
        isLoggingOut={false}
        onLogout={vi.fn()}
        onChangeUsageStatus={onChangeUsageStatus}
      />,
    );

    expect(screen.getByText("利用: 未利用")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "利用開始" }));
    expect(onChangeUsageStatus).toHaveBeenCalledWith("corp-1", "active");

    await user.click(screen.getByRole("combobox", { name: "システム利用状態" }));
    await user.click(screen.getByRole("option", { name: "利用中" }));
    expect(onFilterChange).toHaveBeenCalledWith({ usage_status: "active" });
  });
});
