import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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
  corporate_number: "1111111111111",
  address: "東京都千代田区",
  status: "active",
  created_at: "2026-11-26T00:00:00Z",
  updated_at: "2026-11-26T00:00:00Z",
};

const childCorp: Corporation = {
  ...parentCorp,
  id: "corp-child",
  name: "株式会社子薬局",
  corporate_number: "2222222222222",
};

const sampleRelation: CorporateRelation = {
  id: "rel-1",
  source_corporation_id: "corp-parent",
  target_corporation_id: "corp-child",
  relation_type: "parent_child",
  valid_from: "2026-01-01",
  valid_to: null,
  evidence: "資本関係確認済み",
  confirmation_status: "verified",
  recorded_at: "2026-11-26T00:00:00Z",
  recorded_by: "vendor-1",
};

describe("CorporateRelationsWorkspace", () => {
  const getAnimations = Element.prototype.getAnimations;
  const scrollIntoView = Element.prototype.scrollIntoView;
  let popoverStyle: HTMLStyleElement | null = null;
  beforeAll(() => {
    Element.prototype.getAnimations = () => [];
    Element.prototype.scrollIntoView = () => {};
    popoverStyle = document.createElement("style");
    popoverStyle.textContent = "[popover][data-open] { display: block !important; }";
    document.head.append(popoverStyle);
  });
  afterAll(() => {
    Element.prototype.getAnimations = getAnimations;
    Element.prototype.scrollIntoView = scrollIntoView;
    popoverStyle?.remove();
  });

  it("新規法人間関係を登録し、一覧・絞り込み・終了操作を呼び出せる", async () => {
    const user = userEvent.setup();
    const onRegisterRelation = vi.fn().mockResolvedValue(true);
    const onFilterChange = vi.fn();
    const onEndRelation = vi.fn().mockResolvedValue(true);

    render(
      <CorporateRelationsWorkspace
        currentUser={vendorUser}
        corporations={[parentCorp, childCorp]}
        relations={[sampleRelation]}
        totalCount={1}
        filter={{}}
        onFilterChange={onFilterChange}
        isLoadingRelations={false}
        relationsErrorMessage={null}
        isRegistering={false}
        registerErrorMessage={null}
        onRegisterRelation={onRegisterRelation}
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

    expect(screen.getByText("株式会社親薬局 → 株式会社子薬局")).toBeInTheDocument();

    // 登録フォーム送信
    await user.click(screen.getByRole("combobox", { name: "関係元法人（親・本部等）" }));
    await user.click(screen.getByRole("option", { name: "株式会社親薬局 (corp-parent)" }));
    await user.click(screen.getByRole("combobox", { name: "関係先法人（子・加盟店等）" }));
    await user.click(screen.getByRole("option", { name: "株式会社子薬局 (corp-child)" }));
    await user.type(screen.getByLabelText(/有効開始日/), "2026-04-01");
    await user.type(screen.getByLabelText(/根拠・契約メモ/), "株式取得契約");
    await user.click(screen.getByRole("button", { name: "法人間関係を登録" }));

    expect(onRegisterRelation).toHaveBeenCalledWith({
      source_corporation_id: "corp-parent",
      target_corporation_id: "corp-child",
      relation_type: "parent_child",
      valid_from: "2026-04-01",
      valid_to: null,
      evidence: "株式取得契約",
      confirmation_status: "unverified",
    });

    // 関係終了
    await user.click(screen.getByRole("button", { name: "関係を終了" }));
    await user.type(screen.getByLabelText(/終了日 \(valid_to\)/), "2026-12-31");
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
        isRegistering={false}
        registerErrorMessage={null}
        onRegisterRelation={vi.fn().mockResolvedValue(true)}
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
