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
  corporate_number: "1234567890123",
  address: "東京都新宿区1-2-3",
  status: "active",
  created_at: "2026-11-26T00:00:00Z",
  updated_at: "2026-11-26T00:00:00Z",
};

describe("CorporationsWorkspace", () => {
  it("vendor_member でも新規法人を登録でき、13桁以外の法人番号はバリデーションエラーになる", async () => {
    const user = userEvent.setup();
    const onCreateCorporation = vi.fn().mockResolvedValue(true);

    render(
      <CorporationsWorkspace
        currentUser={vendorMember}
        corporations={[sampleCorporation]}
        totalCount={1}
        filter={{}}
        onFilterChange={vi.fn()}
        isLoadingCorporations={false}
        corporationsErrorMessage={null}
        isCreatingCorporation={false}
        createErrorMessage={null}
        createUserFacingError={null}
        lastCreatedCorporation={null}
        onDismissCreatedBanner={vi.fn()}
        onCreateCorporation={onCreateCorporation}
        isUpdatingCorporation={false}
        updateErrorMessage={null}
        updateUserFacingError={null}
        lastUpdatedCorporation={null}
        onDismissUpdatedBanner={vi.fn()}
        onUpdateCorporation={vi.fn()}
        isLoggingOut={false}
        onLogout={vi.fn()}
      />,
    );

    const nameInput = screen.getByLabelText(/法人名（個人の場合は氏名・屋号）/, {
      selector: "input",
    });
    const numberInput = screen.getByLabelText(/法人番号（13桁）/, { selector: "input" });
    const addressInput = screen.getByLabelText(/本店または主たる事務所の所在地/, {
      selector: "input",
    });

    await user.type(nameInput, "株式会社ひまわり薬局");
    await user.type(numberInput, "12345");
    await user.click(screen.getByRole("button", { name: "企業（法人・個人）を登録" }));

    expect(screen.getByText("法人番号は半角数字13桁で入力してください。")).toBeInTheDocument();
    expect(onCreateCorporation).not.toHaveBeenCalled();

    await user.clear(numberInput);
    await user.type(numberInput, "9876543210123");
    await user.type(addressInput, "大阪府大阪市北区1-1");
    await user.click(screen.getByRole("button", { name: "企業（法人・個人）を登録" }));

    expect(onCreateCorporation).toHaveBeenCalledWith({
      category: "corporation",
      name: "株式会社ひまわり薬局",
      corporate_number: "9876543210123",
      address: "大阪府大阪市北区1-1",
      valid_from: null,
      evidence: null,
    });
    expect(nameInput).toHaveValue("");
    expect(numberInput).toHaveValue("");
    expect(addressInput).toHaveValue("");
  });

  it("登録済み企業の基本情報を編集して保存できる", async () => {
    const user = userEvent.setup();
    const onUpdateCorporation = vi.fn().mockResolvedValue(true);

    render(
      <CorporationsWorkspace
        currentUser={vendorMember}
        corporations={[sampleCorporation]}
        totalCount={1}
        filter={{}}
        onFilterChange={vi.fn()}
        isLoadingCorporations={false}
        corporationsErrorMessage={null}
        isCreatingCorporation={false}
        createErrorMessage={null}
        createUserFacingError={null}
        lastCreatedCorporation={null}
        onDismissCreatedBanner={vi.fn()}
        onCreateCorporation={vi.fn()}
        isUpdatingCorporation={false}
        updateErrorMessage={null}
        updateUserFacingError={null}
        lastUpdatedCorporation={null}
        onDismissUpdatedBanner={vi.fn()}
        onUpdateCorporation={onUpdateCorporation}
        isLoggingOut={false}
        onLogout={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "基本情報を編集" }));

    const editAddressInput = screen.getByLabelText(/変更後の所在地/, { selector: "input" });
    await user.clear(editAddressInput);
    await user.type(editAddressInput, "東京都渋谷区9-9-9");
    await user.click(screen.getByRole("button", { name: "基本情報を保存" }));

    expect(onUpdateCorporation).toHaveBeenCalledWith("corp-1", {
      name: "株式会社さくら薬局",
      corporate_number: "1234567890123",
      address: "東京都渋谷区9-9-9",
      valid_from: null,
      evidence: null,
    });
  });
});
