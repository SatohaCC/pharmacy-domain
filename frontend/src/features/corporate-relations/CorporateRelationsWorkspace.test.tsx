import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/features/auth/schemas";
import type { Corporation } from "@/features/corporations/schemas";
import {
  CorporateRelationsWorkspace,
  type CorporateRelationsWorkspaceProps,
} from "./CorporateRelationsWorkspace";
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

const grandchildCorp: Corporation = {
  ...parentCorp,
  id: "corp-grandchild",
  category: "corporation",
  name: "株式会社孫薬局",
  representative_name: "孫代表 次郎",
  corporate_number: "2222222222222",
};

const franchiseCorp: Corporation = {
  ...parentCorp,
  id: "corp-fc",
  category: "corporation",
  name: "株式会社加盟薬局",
  representative_name: "加盟 三郎",
  corporate_number: "3333333333333",
};

const affiliateCorp: Corporation = {
  ...parentCorp,
  id: "corp-af",
  category: "corporation",
  name: "株式会社関連薬局",
  representative_name: "関連 四郎",
  corporate_number: "4444444444444",
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

const grandchildRelation: CorporateRelation = {
  id: "rel-2",
  source_corporation_id: "corp-child",
  target_corporation_id: "corp-grandchild",
  relation_type: "parent_child",
  valid_from: "2026-02-01",
  valid_to: null,
  evidence: "子会社化登記",
  recorded_at: "2026-11-26T00:00:00Z",
  recorded_by: "vendor-1",
};

const fcRelation: CorporateRelation = {
  id: "rel-fc",
  source_corporation_id: "corp-child",
  target_corporation_id: "corp-fc",
  relation_type: "fc_vc",
  valid_from: "2026-03-01",
  valid_to: null,
  evidence: "FC契約書",
  recorded_at: "2026-11-26T00:00:00Z",
  recorded_by: "vendor-1",
};

const affiliateRelation: CorporateRelation = {
  id: "rel-af",
  source_corporation_id: "corp-af",
  target_corporation_id: "corp-parent",
  relation_type: "affiliate",
  valid_from: "2026-01-15",
  valid_to: "2026-05-01",
  evidence: "業務資本提携",
  recorded_at: "2026-11-26T00:00:00Z",
  recorded_by: "vendor-1",
};

function renderWorkspace(overrides: Partial<CorporateRelationsWorkspaceProps> = {}) {
  return render(
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
      onCorrectRelation={vi.fn().mockResolvedValue(true)}
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
      today="2026-06-01"
      {...overrides}
    />,
  );
}

describe("CorporateRelationsWorkspace", () => {
  it("初期表示で関係図（階層ツリー）タブが選択され、親→子→孫の階層と通知・登録リンクを確認できる", async () => {
    const user = userEvent.setup();
    const onDismissNotice = vi.fn();

    renderWorkspace({
      corporations: [parentCorp, childCorp, grandchildCorp],
      relations: [sampleRelation, grandchildRelation],
      totalCount: 2,
      notice: "created",
      onDismissNotice,
    });

    expect(screen.getByRole("tab", { name: "関係図（階層ツリー）" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("heading", { name: "親子関係の階層ツリー（2件）" }),
    ).toBeInTheDocument();
    expect(screen.getByText("株式会社親薬局")).toBeInTheDocument();
    expect(screen.getByText("子薬局")).toBeInTheDocument();
    expect(screen.getByText("株式会社孫薬局")).toBeInTheDocument();
    expect(screen.getByText("親: 株式会社親薬局")).toBeInTheDocument();
    expect(screen.getByText("親: 子薬局")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "新規関係を登録" })).toHaveAttribute(
      "href",
      "/vendor/corporations/relations/new",
    );
    expect(screen.getByText("法人間関係を登録しました")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "登録完了メッセージを閉じる" }));
    expect(onDismissNotice).toHaveBeenCalledTimes(1);
  });

  it("関係図タブで個別ノードおよび一括の折りたたみ・展開ができる", async () => {
    const user = userEvent.setup();

    renderWorkspace({
      corporations: [parentCorp, childCorp, grandchildCorp],
      relations: [sampleRelation, grandchildRelation],
      totalCount: 2,
    });

    const collapseButtons = screen.getAllByRole("button", { name: /配下を折りたたむ/ });
    expect(collapseButtons).toHaveLength(2);

    // 親ノードの配下を折りたたむと子・孫が非表示になる
    await user.click(collapseButtons[0]);
    expect(screen.queryByText("子薬局")).not.toBeInTheDocument();
    expect(screen.queryByText("株式会社孫薬局")).not.toBeInTheDocument();

    // すべて展開で再表示される
    await user.click(screen.getByRole("button", { name: "すべて展開" }));
    expect(screen.getByText("子薬局")).toBeInTheDocument();
    expect(screen.getByText("株式会社孫薬局")).toBeInTheDocument();

    // すべて折りたたむで全配下が閉じる
    await user.click(screen.getByRole("button", { name: "すべて折りたたむ" }));
    expect(screen.queryByText("子薬局")).not.toBeInTheDocument();
  });

  it("関連会社とFC/VC契約が親子ノードの紐づけと下部セクションに役割ラベル付きで表示される", () => {
    renderWorkspace({
      corporations: [parentCorp, childCorp, franchiseCorp, affiliateCorp],
      relations: [sampleRelation, fcRelation, affiliateRelation],
      totalCount: 3,
    });

    const treeSection = screen.getByRole("region", { name: "親子関係の階層ツリー（1件）" });
    expect(within(treeSection).getByText(/自法人: 本部/)).toBeInTheDocument();
    expect(within(treeSection).getByText(/加盟店: 株式会社加盟薬局/)).toBeInTheDocument();
    expect(within(treeSection).getByText(/自法人: 関連先/)).toBeInTheDocument();

    const otherSection = screen.getByRole("region", { name: "関連会社・FC / VC 契約（2件）" });
    expect(within(otherSection).getByText("本部 → 加盟店")).toBeInTheDocument();
    expect(within(otherSection).getByText("関連元 → 関連先")).toBeInTheDocument();
    expect(within(otherSection).getByText("株式会社加盟薬局")).toBeInTheDocument();
    expect(within(otherSection).getByText("株式会社関連薬局")).toBeInTheDocument();
    expect(within(otherSection).getByText("終了")).toBeInTheDocument();
  });

  it("関係図タブ上から訂正パネル・終了パネルの排他制御、変更項目のみ送信、終了操作を実行できる", async () => {
    const user = userEvent.setup();
    const onCorrectRelation = vi.fn().mockResolvedValue(true);
    const onEndRelation = vi.fn().mockResolvedValue(true);

    renderWorkspace({
      onCorrectRelation,
      onEndRelation,
    });

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

    // 関係終了を実行する
    await user.click(screen.getByRole("button", { name: "関係を終了" }));
    await user.type(screen.getByLabelText(/終了日/), "2026-12-31");
    await user.click(screen.getByRole("button", { name: "この日で終了" }));
    expect(onEndRelation).toHaveBeenCalledWith("rel-1", "2026-12-31");
  });

  it("一覧テーブルタブに切り替えると役割ラベルと終了バッジ付きで表示され、テーブル上から終了操作できる", async () => {
    const user = userEvent.setup();
    const onEndRelation = vi.fn().mockResolvedValue(true);
    const endedRelation: CorporateRelation = {
      ...sampleRelation,
      id: "rel-ended",
      valid_from: "2025-01-01",
      valid_to: "2026-05-01",
    };

    renderWorkspace({
      relations: [endedRelation],
      onEndRelation,
    });

    await user.click(screen.getByRole("tab", { name: "一覧テーブル" }));

    const table = screen.getByRole("table");
    expect(
      within(table).getByRole("columnheader", { name: "関係元（親・本部）" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: "関係先（子・加盟店）" }),
    ).toBeInTheDocument();
    expect(within(table).getByText("親法人")).toBeInTheDocument();
    expect(within(table).getByText("子法人")).toBeInTheDocument();
    expect(within(table).getByText("終了")).toBeInTheDocument();

    await user.click(within(table).getByRole("button", { name: "関係を終了" }));
    await user.type(screen.getByLabelText(/終了日/), "2026-12-31");
    await user.click(screen.getByRole("button", { name: "この日で終了" }));
    expect(onEndRelation).toHaveBeenCalledWith("rel-ended", "2026-12-31");
  });
});
