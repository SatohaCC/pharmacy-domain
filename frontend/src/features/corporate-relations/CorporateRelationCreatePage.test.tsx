import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/features/auth/schemas";
import type { Corporation } from "@/features/corporations/schemas";
import { CorporateRelationCreatePage } from "./CorporateRelationCreatePage";

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

describe("CorporateRelationCreatePage", () => {
  it("セレクトボックスにUUIDを含めず代表者・開設者を表示し、新規関係を登録できる", async () => {
    const user = userEvent.setup();
    const onRegisterRelation = vi.fn().mockResolvedValue(true);

    render(
      <CorporateRelationCreatePage
        currentUser={vendorUser}
        corporations={[parentCorp, childCorp]}
        isRegistering={false}
        registerErrorMessage={null}
        onRegisterRelation={onRegisterRelation}
        isLoggingOut={false}
        onLogout={vi.fn()}
      />,
    );

    expect(screen.getByRole("link", { name: "法人間関係一覧へ戻る" })).toHaveAttribute(
      "href",
      "/vendor/corporations/relations",
    );

    await user.click(screen.getByRole("combobox", { name: "関係元法人（親・本部等）" }));
    expect(screen.queryByRole("option", { name: /corp-parent/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "株式会社親薬局（代表: 親代表 太郎）" }));

    await user.click(screen.getByRole("combobox", { name: "関係先法人（子・加盟店等）" }));
    expect(screen.queryByRole("option", { name: /corp-child/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "子薬局（開設者: 山田 花子）" }));

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
    });
  });
});
