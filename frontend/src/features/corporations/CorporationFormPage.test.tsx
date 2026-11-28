import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/features/auth/schemas";
import { CorporationFormPage } from "./CorporationFormPage";
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
  usage_status: "not_started",
  created_at: "2026-11-26T00:00:00Z",
  updated_at: "2026-11-26T00:00:00Z",
};

describe("CorporationFormPage", () => {
  it("登録モードでバリデーション後に新規企業を登録できる", async () => {
    const user = userEvent.setup();
    const onCreateCorporation = vi.fn().mockResolvedValue(true);

    render(
      <CorporationFormPage
        mode="create"
        currentUser={vendorMember}
        isSubmitting={false}
        submitErrorMessage={null}
        submitUserFacingError={null}
        onCreateCorporation={onCreateCorporation}
        isLoggingOut={false}
        onLogout={vi.fn()}
      />,
    );

    expect(screen.getByRole("link", { name: "法人一覧へ戻る" })).toHaveAttribute(
      "href",
      "/vendor/corporations",
    );

    const nameInput = screen.getByLabelText(/法人名（個人の場合は氏名・屋号）/, {
      selector: "input",
    });
    const repInput = screen.getByLabelText(/代表者名/, { selector: "input" });
    const numberInput = screen.getByLabelText(/法人番号（13桁）/, { selector: "input" });
    const addressInput = screen.getByLabelText(/本店または主たる事務所の所在地/, {
      selector: "input",
    });

    await user.type(nameInput, "株式会社ひまわり薬局");
    await user.type(repInput, "山田 太郎");
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
      representative_name: "山田 太郎",
      corporate_number: "9876543210123",
      address: "大阪府大阪市北区1-1",
      valid_from: null,
      valid_to: null,
      evidence: null,
      usage_status: "not_started",
    });
  });

  it("登録モードで個人開設者を選ぶと法人番号が無効になり、開設者氏名ラベルに切り替わる", async () => {
    const user = userEvent.setup();
    render(
      <CorporationFormPage
        mode="create"
        currentUser={vendorMember}
        isSubmitting={false}
        submitErrorMessage={null}
        submitUserFacingError={null}
        onCreateCorporation={vi.fn().mockResolvedValue(true)}
        isLoggingOut={false}
        onLogout={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("radio", { name: "個人開設者" }));
    expect(screen.getByLabelText(/開設者氏名/, { selector: "input" })).toBeInTheDocument();
    expect(screen.getByLabelText(/法人番号（13桁）/, { selector: "input" })).toBeDisabled();
  });

  it("登録モードで有効終了日が有効開始日以前の場合は送信を拒否する", async () => {
    const user = userEvent.setup();
    const onCreateCorporation = vi.fn().mockResolvedValue(true);

    render(
      <CorporationFormPage
        mode="create"
        currentUser={vendorMember}
        isSubmitting={false}
        submitErrorMessage={null}
        submitUserFacingError={null}
        onCreateCorporation={onCreateCorporation}
        isLoggingOut={false}
        onLogout={vi.fn()}
      />,
    );

    await user.type(
      screen.getByLabelText(/法人名（個人の場合は氏名・屋号）/, { selector: "input" }),
      "期間不正法人",
    );
    await user.type(screen.getByLabelText(/代表者名/, { selector: "input" }), "代表太郎");
    await user.click(screen.getByText("詳細設定（有効期間・確認根拠・初期利用状態）"));
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

  it("編集モードでは既存値を初期表示し、変更された項目のみを送信する", async () => {
    const user = userEvent.setup();
    const onUpdateCorporation = vi.fn().mockResolvedValue(true);

    render(
      <CorporationFormPage
        mode="edit"
        currentUser={vendorMember}
        initialCorporation={sampleCorporation}
        isSubmitting={false}
        submitErrorMessage={null}
        submitUserFacingError={null}
        onUpdateCorporation={onUpdateCorporation}
        isLoggingOut={false}
        onLogout={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("combobox", { name: "初期システム利用状態" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "個人開設者" })).toBeDisabled();

    // 未変更のまま保存しようとするとエラーを表示し送信しない
    await user.click(screen.getByRole("button", { name: "基本情報を保存" }));
    expect(
      screen.getByText(
        "変更された項目がありません。名称・代表者名・法人番号・所在地・有効終了日のいずれかを変更してください。",
      ),
    ).toBeInTheDocument();
    expect(onUpdateCorporation).not.toHaveBeenCalled();

    const repInput = screen.getByLabelText(/代表者名/, { selector: "input" });
    const addressInput = screen.getByLabelText(/本店または主たる事務所の所在地/, {
      selector: "input",
    });
    await user.click(screen.getByText("有効期間・確認根拠・識別情報（任意）"));
    const validFromInput = screen.getByLabelText(/変更の有効開始日（任意）/, {
      selector: "input",
    });
    const validToInput = screen.getByLabelText(/変更後の有効終了日（任意）/, {
      selector: "input",
    });

    await user.clear(repInput);
    await user.type(repInput, "高橋 次郎");
    await user.clear(addressInput);
    await user.type(addressInput, "東京都渋谷区9-9-9");
    await user.type(validFromInput, "2026-09-01");
    await user.type(validToInput, "2027-08-31");
    await user.click(screen.getByRole("button", { name: "基本情報を保存" }));

    expect(onUpdateCorporation).toHaveBeenCalledWith("corp-1", {
      representative_name: "高橋 次郎",
      address: "東京都渋谷区9-9-9",
      valid_from: "2026-09-01",
      valid_to: "2027-08-31",
    });
  });

  it("編集モードで initialCorporation が再取得で更新された場合、未編集項目は最新化し編集中項目は保持する", async () => {
    const user = userEvent.setup();
    const onUpdateCorporation = vi.fn().mockResolvedValue(true);

    const { rerender } = render(
      <CorporationFormPage
        mode="edit"
        currentUser={vendorMember}
        initialCorporation={{ ...sampleCorporation, name: "旧名称" }}
        isSubmitting={false}
        submitErrorMessage={null}
        submitUserFacingError={null}
        onUpdateCorporation={onUpdateCorporation}
        isLoggingOut={false}
        onLogout={vi.fn()}
      />,
    );

    const addressInput = screen.getByLabelText(/本店または主たる事務所の所在地/, {
      selector: "input",
    });
    await user.clear(addressInput);
    await user.type(addressInput, "東京都渋谷区9-9-9");

    rerender(
      <CorporationFormPage
        mode="edit"
        currentUser={vendorMember}
        initialCorporation={{
          ...sampleCorporation,
          name: "訂正後名称",
          updated_at: "2026-06-02T00:00:00Z",
        }}
        isSubmitting={false}
        submitErrorMessage={null}
        submitUserFacingError={null}
        onUpdateCorporation={onUpdateCorporation}
        isLoggingOut={false}
        onLogout={vi.fn()}
      />,
    );

    expect(
      screen.getByLabelText(/法人名（個人の場合は氏名・屋号）/, { selector: "input" }),
    ).toHaveValue("訂正後名称");
    expect(addressInput).toHaveValue("東京都渋谷区9-9-9");

    await user.click(screen.getByRole("button", { name: "基本情報を保存" }));
    expect(onUpdateCorporation).toHaveBeenCalledWith("corp-1", {
      address: "東京都渋谷区9-9-9",
    });
  });

  it("編集モードで利用開始・利用停止を押すと確認ダイアログが開き、確定時のみ送信する", async () => {
    const user = userEvent.setup();
    const onChangeUsageStatus = vi.fn().mockResolvedValue(true);

    const { rerender } = render(
      <CorporationFormPage
        mode="edit"
        currentUser={vendorMember}
        initialCorporation={{ ...sampleCorporation, usage_status: "not_started" }}
        isSubmitting={false}
        submitErrorMessage={null}
        submitUserFacingError={null}
        onUpdateCorporation={vi.fn().mockResolvedValue(true)}
        onChangeUsageStatus={onChangeUsageStatus}
        isLoggingOut={false}
        onLogout={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("tab", { name: "利用状態・解散/合併" }));
    expect(screen.getAllByText("利用: 未利用").length).toBeGreaterThan(0);

    // 「利用開始」クリック時はダイアログのみ開き、APIはまだ呼ばれない
    await user.click(screen.getByRole("button", { name: "利用開始" }));
    expect(screen.getByRole("dialog", { name: "システム利用を開始しますか？" })).toBeVisible();
    expect(onChangeUsageStatus).not.toHaveBeenCalled();

    // キャンセル時は閉じるだけ
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onChangeUsageStatus).not.toHaveBeenCalled();

    // 再度開いて確定すると API 呼び出し後に閉じる
    await user.click(screen.getByRole("button", { name: "利用開始" }));
    await user.click(screen.getByRole("button", { name: "利用を開始する" }));
    expect(onChangeUsageStatus).toHaveBeenCalledWith("corp-1", "active");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // 利用中の場合は利用停止確認ダイアログが出る
    rerender(
      <CorporationFormPage
        mode="edit"
        currentUser={vendorMember}
        initialCorporation={{ ...sampleCorporation, usage_status: "active" }}
        isSubmitting={false}
        submitErrorMessage={null}
        submitUserFacingError={null}
        onUpdateCorporation={vi.fn().mockResolvedValue(true)}
        onChangeUsageStatus={onChangeUsageStatus}
        isLoggingOut={false}
        onLogout={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("tab", { name: "利用状態・解散/合併" }));
    await user.click(screen.getByRole("button", { name: "利用停止" }));
    expect(screen.getByRole("dialog", { name: "システム利用を停止しますか？" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "利用を停止する" }));
    expect(onChangeUsageStatus).toHaveBeenCalledWith("corp-1", "suspended");
  });

  it("編集モードの履歴・状態管理パネルで合併・時点照会・履歴訂正を実行できる", async () => {
    const user = userEvent.setup();
    const survivingCorporation: Corporation = {
      ...sampleCorporation,
      id: "corp-2",
      name: "株式会社わかば薬局",
      representative_name: "鈴木 花子",
      corporate_number: "9999999999999",
    };
    const onLookupSnapshot = vi.fn();
    const onChangeStatus = vi.fn().mockResolvedValue(true);
    const onCorrectHistory = vi.fn().mockResolvedValue(true);

    render(
      <CorporationFormPage
        mode="edit"
        currentUser={vendorMember}
        initialCorporation={sampleCorporation}
        isSubmitting={false}
        submitErrorMessage={null}
        submitUserFacingError={null}
        onUpdateCorporation={vi.fn().mockResolvedValue(true)}
        activeCorporations={[sampleCorporation, survivingCorporation]}
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
        isLoggingOut={false}
        onLogout={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("tab", { name: "利用状態・解散/合併" }));
    await user.click(screen.getByRole("combobox", { name: "変更後の状態" }));
    await user.click(screen.getByRole("option", { name: "吸収合併（消滅）" }));
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

    await user.click(screen.getByRole("tab", { name: "変更履歴・訂正" }));
    expect(screen.getByText(/変更者: vendor-admin-1/)).toBeInTheDocument();
    await user.click(screen.getByText("過去時点の状態を照会"));
    await user.type(screen.getByLabelText("基準日"), "2026-06-01");
    await user.click(screen.getByRole("button", { name: "時点照会" }));
    expect(onLookupSnapshot).toHaveBeenCalledWith({
      as_of: "2026-06-01",
      recorded_as_of: undefined,
    });

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

  it("解散済み法人の編集画面では基本情報編集を抑止しつつ履歴タイムラインを表示する", async () => {
    const user = userEvent.setup();
    render(
      <CorporationFormPage
        mode="edit"
        currentUser={vendorMember}
        initialCorporation={{ ...sampleCorporation, status: "dissolved" }}
        isSubmitting={false}
        submitErrorMessage={null}
        submitUserFacingError={null}
        onUpdateCorporation={vi.fn().mockResolvedValue(true)}
        onChangeUsageStatus={vi.fn().mockResolvedValue(true)}
        activeCorporations={[]}
        historyRecords={[
          {
            corporation: { ...sampleCorporation, status: "dissolved" },
            valid_from: "2026-01-01",
            valid_to: null,
            recorded_at: "2026-11-26T00:00:00+09:00",
            kind: "dissolution",
            evidence: "解散登記",
            surviving_corporation_id: null,
            recorded_by: "vendor-admin-1",
          },
        ]}
        onLookupSnapshot={vi.fn()}
        onChangeStatus={vi.fn().mockResolvedValue(true)}
        onCorrectHistory={vi.fn().mockResolvedValue(true)}
        isLoggingOut={false}
        onLogout={vi.fn()}
      />,
    );

    expect(screen.getByText("基本情報は編集できません")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "基本情報を保存" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "変更履歴・訂正" }));
    expect(screen.getByText("変更履歴タイムライン")).toBeInTheDocument();
  });
});
