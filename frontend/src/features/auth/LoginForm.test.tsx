import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LoginForm } from "./LoginForm";

describe("LoginForm", () => {
  it("空欄送信時は必須エラーを表示し onSubmit を呼ばない", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <LoginForm
        isSubmitting={false}
        errorMessage={null}
        userFacingError={null}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole("button", { name: "ログイン" }));

    expect(screen.getByText("メールアドレスを入力してください。")).toBeInTheDocument();
    expect(screen.getByText("パスワードを入力してください。")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("有効な入力で onSubmit を呼び出し、5要素エラーを表示できる", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    const { rerender } = render(
      <LoginForm
        isSubmitting={false}
        errorMessage={null}
        userFacingError={null}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText(/メールアドレス/), "  admin@vendor.example.com  ");
    await user.type(screen.getByLabelText(/パスワード/, { selector: "input" }), "VendorAdmin123!");
    await user.click(screen.getByRole("button", { name: "ログイン" }));

    expect(onSubmit).toHaveBeenCalledWith({
      email: "admin@vendor.example.com",
      password: "VendorAdmin123!",
    });

    rerender(
      <LoginForm
        isSubmitting={false}
        errorMessage="メールアドレスまたはパスワードが正しくありません。"
        userFacingError={{
          title: "ログインできませんでした",
          reassurance: "既存のデータは変更されていません。",
          reason: "メールアドレスまたはパスワードが正しくありません。",
          how_to_fix: "メールアドレスとパスワードをご確認のうえ、もう一度お試しください。",
          way_out: "サポートへお問い合わせください。",
          actions: [],
          details: null,
        }}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("ログインできませんでした");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "メールアドレスまたはパスワードが正しくありません。",
    );
  });
});
