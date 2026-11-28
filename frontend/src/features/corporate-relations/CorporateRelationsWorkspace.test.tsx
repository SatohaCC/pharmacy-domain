import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/features/auth/schemas";
import type { Corporation } from "@/features/corporations/schemas";
import { CorporateRelationsWorkspace } from "./CorporateRelationsWorkspace";
import type { CorporateRelation } from "./schemas";

const vendorUser: AuthUser = {
  id: "vendor-1",
  email: "admin@vendor.example.com",
  display_name: "管理者",
  affiliation_type: "vendor",
  tenant_id: null,
  roles: ["vendor_admin"],
  status: "active",
  created_at: "2026-11-26T00:00:00Z",
  updated_at: "2026-11-26T00:00:00Z",
};

const parentCorp: Corporation = {
  id: "corp-parent",
  category: "corporation",
  name: "株式会社親薬局",
  representative_name: "親代表 太郎",
  corporate_number: "1111111111111",
  address: "東京都千代田区",
  status: "active",
  created_at: "2026-11-26T00:00:00Z",
  updated_at: "2026-11-26T00:00:00Z",
};

const childCorp: Corporation = {
  ...parentCorp,
  id: "corp-child",
  category: "individual",
  name: "子薬局",
  representative_name: "山田 花子",
  corporate_number: null,
};

const sampleRelation: CorporateRelation = {
  id: "rel-1",
  source_corporation_id: "corp-parent",
  target_corporation_id: "corp-child",
  relation_type: "parent_child",
  valid_from: "2026-01-01",
  valid_to: null,
  evidence: "資本関係確認済み",
  recorded_at: "2026-11-26T00:00:00Z",
  recorded_by: "vendor-1",
};

describe("CorporateRelationsWorkspace", () => {
  it("テーブル一覧・登録画面への遷移リンク・完了通知・終了操作を実行できる", async () => {
    const user = userEvent.setup();
    const onDismissNotice = vi.fn();
    const onEndRelation = vi.fn().mockResolvedValue(true);

    render(
      <CorporateRelationsWorkspace
        currentUser={vendorUser}
        corporations={[parentCorp, childCorp]}
        relations={[sampleRelation]}
        totalCount={1}
        filter={{}}
        onFilterChange={vi.fn()}
        isLoadingRelations={false}
        relationsErrorMessage={null}
        notice="created"
        onDismissNotice={onDismissNotice}
        isCorrecting={false}
        correctErrorMessage={null}
        onCorrectRelation={vi.fn().mockResolvedValue(true)}
        isEnding={false}
        endErrorMessage={null}
        onEndRelation={onEndRelation}
        selectedHistoryRelationId={null}
        onSelectHistoryRelation={vi.fn()}
        revisions={[]}
        isLoadingRevisions={false}
        revisionsErrorMessage={null}
        isLoggingOut={false}
        onLogout={vi.fn()}
      />,
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "株式会社親薬局" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "新規関係を登録" })).toHaveAttribute(
      "href",
      "/vendor/corporations/relations/new",
    );
    expect(screen.getByText("法人間関係を登録しました")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "登録完了メッセージを閉じる" }));
    expect(onDismissNotice).toHaveBeenCalledTimes(1);

    // 関係終了
    await user.click(screen.getByRole("button", { name: "関係を終了" }));
    await user.type(screen.getByLabelText(/終了日/), "2026-12-31");
    await user.click(screen.getByRole("button", { name: "この日で終了" }));
    expect(onEndRelation).toHaveBeenCalledWith("rel-1", "2026-12-31");
  });

  it("訂正パネルと終了パネルは排他制御され、訂正時は変更された項目のみを送信する", async () => {
    const user = userEvent.setup();
    const onCorrectRelation = vi.fn().mockResolvedValue(true);

    render(
      <CorporateRelationsWorkspace
        currentUser={vendorUser}
        corporations={[parentCorp, childCorp]}
        relations={[sampleRelation]}
        totalCount={1}
        filter={{}}
        onFilterChange={vi.fn()}
        isLoadingRelations={false}
        relationsErrorMessage={null}
        isCorrecting={false}
        correctErrorMessage={null}
        onCorrectRelation={onCorrectRelation}
        isEnding={false}
        endErrorMessage={null}
        onEndRelation={vi.fn().mockResolvedValue(true)}
        selectedHistoryRelationId={null}
        onSelectHistoryRelation={vi.fn()}
        revisions={[]}
        isLoadingRevisions={false}
        revisionsErrorMessage={null}
        isLoggingOut={false}
        onLogout={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "訂正" }));
    expect(screen.getByText("関係の訂正")).toBeInTheDocument();

    // 終了パネルを開くと訂正パネルが閉じる
    await user.click(screen.getByRole("button", { name: "関係を終了" }));
    expect(screen.queryByText("関係の訂正")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "この日で終了" })).toBeInTheDocument();

    // 再度訂正パネルを開き、根拠のみ変更して送信すると valid_to: null は送られない
    await user.click(screen.getByRole("button", { name: "訂正" }));
    expect(screen.queryByRole("button", { name: "この日で終了" })).not.toBeInTheDocument();
    const evidenceInput = screen.getByLabelText("根拠・契約メモ", {
      selector: 'input[name="edit_evidence_rel-1"]',
    });
    await user.clear(evidenceInput);
    await user.type(evidenceInput, "登記簿再確認");
    await user.click(screen.getByRole("button", { name: "訂正を保存" }));

    expect(onCorrectRelation).toHaveBeenCalledWith("rel-1", {
      evidence: "登記簿再確認",
    });
  });
});
