import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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
        isFetchingCorporations={false}
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
      valid_to: null,
      evidence: null,
    });
    expect(nameInput).toHaveValue("");
    expect(numberInput).toHaveValue("");
    expect(addressInput).toHaveValue("");
  });

  it("基本情報の編集では変更された項目のみを送信し、過去効力日指定時に未変更項目を上書きしない", async () => {
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
        isFetchingCorporations={false}
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

    // 未変更のまま保存しようとするとエラーを表示し送信しない
    await user.click(screen.getByRole("button", { name: "基本情報を保存" }));
    expect(
      screen.getByText(
        "変更された項目がありません。名称・法人番号・所在地・有効終了日のいずれかを変更してください。",
      ),
    ).toBeInTheDocument();
    expect(onUpdateCorporation).not.toHaveBeenCalled();

    const editAddressInput = screen.getByLabelText(/変更後の所在地/, { selector: "input" });
    const editValidFromInput = screen.getByLabelText(/変更の有効開始日（任意）/, {
      selector: "input",
    });
    const editValidToInput = screen.getByLabelText(/変更後の有効終了日（任意）/, {
      selector: "input",
    });
    await user.clear(editAddressInput);
    await user.type(editAddressInput, "東京都渋谷区9-9-9");
    await user.type(editValidFromInput, "2026-09-01");
    await user.type(editValidToInput, "2027-08-31");
    await user.click(screen.getByRole("button", { name: "基本情報を保存" }));

    expect(onUpdateCorporation).toHaveBeenCalledWith("corp-1", {
      address: "東京都渋谷区9-9-9",
      valid_from: "2026-09-01",
      valid_to: "2027-08-31",
    });
  });

  it("有効終了日が有効開始日以前の場合は登録を拒否する", async () => {
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
        isFetchingCorporations={false}
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

    await user.type(
      screen.getByLabelText(/法人名（個人の場合は氏名・屋号）/, { selector: "input" }),
      "期間不正法人",
    );
    await user.type(
      screen.getByLabelText(/有効開始日（任意）/, { selector: "input" }),
      "2026-05-01",
    );
    await user.type(
      screen.getByLabelText(/有効終了日（任意）/, { selector: "input" }),
      "2026-05-01",
    );
    await user.click(screen.getByRole("button", { name: "企業（法人・個人）を登録" }));

    expect(
      screen.getByText("有効終了日は有効開始日より後の日付を指定してください。"),
    ).toBeInTheDocument();
    expect(onCreateCorporation).not.toHaveBeenCalled();
  });

  it("履歴・状態管理パネルで合併・時点照会・履歴訂正を実行できる", async () => {
    const user = userEvent.setup();
    const survivingCorporation: Corporation = {
      ...sampleCorporation,
      id: "corp-2",
      name: "株式会社わかば薬局",
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
        isCreatingCorporation={false}
        createErrorMessage={null}
        createUserFacingError={null}
        lastCreatedCorporation={null}
        onDismissCreatedBanner={vi.fn()}
        onCreateCorporation={vi.fn().mockResolvedValue(true)}
        isUpdatingCorporation={false}
        updateErrorMessage={null}
        updateUserFacingError={null}
        lastUpdatedCorporation={null}
        onDismissUpdatedBanner={vi.fn()}
        onUpdateCorporation={vi.fn().mockResolvedValue(true)}
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
    await user.click(screen.getByRole("option", { name: "株式会社わかば薬局 (corp-2)" }));
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
});
