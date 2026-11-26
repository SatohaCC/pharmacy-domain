import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { VendorUser } from "./schemas";
import { VendorUsersWorkspace } from "./VendorUsersWorkspace";

const adminUser: VendorUser = {
  id: "admin-1",
  email: "admin@vendor.example.com",
  display_name: "初期管理者",
  role: "admin",
  status: "active",
  created_at: "2026-11-26T00:00:00Z",
  updated_at: "2026-11-26T00:00:00Z",
};

const memberUser: VendorUser = {
  id: "member-1",
  email: "member@vendor.example.com",
  display_name: "運用社員",
  role: "member",
  status: "active",
  created_at: "2026-11-26T01:00:00Z",
  updated_at: "2026-11-26T01:00:00Z",
};

describe("VendorUsersWorkspace", () => {
  it("admin ロールでは安全なパスワード自動生成を使って新規ベンダー社員を発行し、成功後にフォームを初期化する", async () => {
    const user = userEvent.setup();
    const onCreateUser = vi.fn().mockResolvedValue(true);
    const onLogout = vi.fn();

    render(
      <VendorUsersWorkspace
        currentUser={adminUser}
        users={[adminUser]}
        isLoadingUsers={false}
        usersErrorMessage={null}
        isCreatingUser={false}
        createErrorMessage={null}
        createUserFacingError={null}
        lastIssuedUser={null}
        isLoggingOut={false}
        onCreateUser={onCreateUser}
        onDismissIssuedBanner={vi.fn()}
        onLogout={onLogout}
      />,
    );

    const nameInput = screen.getByLabelText(/氏名（表示名）/, { selector: "input" });
    const emailInput = screen.getByLabelText(/メールアドレス/, { selector: "input" });
    const passwordInput = screen.getByLabelText(/初期パスワード/, { selector: "input" });

    await user.type(nameInput, "運用 太郎");
    await user.type(emailInput, "taro@vendor.example.com");
    await user.click(screen.getByRole("button", { name: "安全なパスワードを自動生成" }));
    await user.click(screen.getByRole("button", { name: "ベンダー社員アカウントを発行" }));

    expect(onCreateUser).toHaveBeenCalledTimes(1);
    const payload = onCreateUser.mock.calls[0]?.[0];
    expect(payload.email).toBe("taro@vendor.example.com");
    expect(payload.display_name).toBe("運用 太郎");
    expect(payload.role).toBe("member");
    expect(payload.password.length).toBeGreaterThanOrEqual(13);

    expect(nameInput).toHaveValue("");
    expect(emailInput).toHaveValue("");
    expect(passwordInput).toHaveValue("");

    await user.click(screen.getByRole("button", { name: "ログアウト" }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("member ロールでは発行フォームや一覧を表示せず権限案内を表示する", () => {
    render(
      <VendorUsersWorkspace
        currentUser={memberUser}
        users={[]}
        isLoadingUsers={false}
        usersErrorMessage={null}
        isCreatingUser={false}
        createErrorMessage={null}
        createUserFacingError={null}
        lastIssuedUser={null}
        isLoggingOut={false}
        onCreateUser={vi.fn()}
        onDismissIssuedBanner={vi.fn()}
        onLogout={vi.fn()}
      />,
    );

    expect(screen.getByText("一般社員アカウントでログインしています")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "ベンダー社員アカウントの発行" }),
    ).not.toBeInTheDocument();
  });
});
