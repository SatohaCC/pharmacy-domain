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

const activeCorporation: Corporation = {
  id: "corp-1",
  category: "corporation",
  name: "株式会社さくら薬局",
  representative_name: "佐藤 一郎",
  corporate_number: "1234567890123",
  address: "東京都新宿区1-2-3",
  status: "active",
  usage_status: "not_started",
  created_at: "2026-11-26T00:00:00Z",
  updated_at: "2026-11-26T00:00:00Z",
};

const dissolvedCorporation: Corporation = {
  ...activeCorporation,
  id: "corp-2",
  name: "株式会社旧薬局",
  status: "dissolved",
  usage_status: "suspended",
};

describe("CorporationsWorkspace", () => {
  it("一覧から登録画面・編集管理画面への遷移リンクと完了通知を表示し、状態操作を置かない", async () => {
    const user = userEvent.setup();
    const onDismissNotice = vi.fn();

    render(
      <CorporationsWorkspace
        currentUser={vendorMember}
        corporations={[activeCorporation, dissolvedCorporation]}
        totalCount={2}
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

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "法人名" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "代表者 / 開設者" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: /株式会社さくら薬局/ })).toBeInTheDocument();
    expect(screen.queryByText("テナントID:")).not.toBeInTheDocument();
    for (const label of screen.getAllByText(/^(代表者|開設者|所在地|存続状態|利用状態):$/)) {
      expect(label).not.toHaveAttribute("aria-hidden");
    }
    expect(screen.getByRole("link", { name: "新規企業を登録" })).toHaveAttribute(
      "href",
      "/vendor/corporations/new",
    );
    expect(screen.getByRole("link", { name: "編集・管理" })).toHaveAttribute(
      "href",
      "/vendor/corporations/corp-1/edit",
    );
    expect(screen.getByRole("link", { name: "履歴を確認" })).toHaveAttribute(
      "href",
      "/vendor/corporations/corp-2/edit",
    );
    expect(screen.queryByRole("button", { name: "利用開始" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "利用停止" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "履歴・状態管理" })).not.toBeInTheDocument();
    expect(screen.getByText("企業（テナント）を登録しました")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "登録完了メッセージを閉じる" }));
    expect(onDismissNotice).toHaveBeenCalledTimes(1);
  });

  it("システム利用状態フィルタで絞り込み条件を更新できる", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();

    render(
      <CorporationsWorkspace
        currentUser={vendorMember}
        corporations={[activeCorporation]}
        totalCount={1}
        filter={{}}
        onFilterChange={onFilterChange}
        isLoadingCorporations={false}
        isFetchingCorporations={false}
        corporationsErrorMessage={null}
        isLoggingOut={false}
        onLogout={vi.fn()}
      />,
    );

    expect(screen.getByText("利用: 未利用")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "システム利用状態" }));
    await user.click(screen.getByRole("option", { name: "利用中" }));
    expect(onFilterChange).toHaveBeenCalledWith({ usage_status: "active" });
  });
});
