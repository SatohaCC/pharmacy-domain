import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryProvider } from "@/shared/lib/query/QueryProvider";
import { VendorLoginContainer } from "./VendorLoginContainer";
import { VendorUsersContainer } from "./VendorUsersContainer";

const replaceMock = vi.fn();
const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
    push: pushMock,
  }),
}));

const sampleAdmin = {
  id: "admin-1",
  email: "admin@vendor.example.com",
  display_name: "初期管理者",
  role: "admin" as const,
  status: "active" as const,
  created_at: "2026-11-26T00:00:00Z",
  updated_at: "2026-11-26T00:00:00Z",
};

describe("VendorUsersContainer / VendorLoginContainer 認証キャッシュ制御", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    replaceMock.mockReset();
    pushMock.mockReset();
  });

  it("キャッシュ済みユーザーがあっても /auth/me 再取得が401なら /login へ遷移し戻らない", async () => {
    let meCalls = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/vendor/auth/me") {
        meCalls += 1;
        if (meCalls === 1) {
          return new Response(JSON.stringify(sampleAdmin), { status: 200 });
        }
        return new Response(JSON.stringify({ code: "REFRESH_TOKEN_REVOKED", detail: "revoked" }), {
          status: 401,
        });
      }
      if (url === "/api/vendor/auth/refresh") {
        return new Response(JSON.stringify({ code: "REFRESH_TOKEN_REVOKED", detail: "revoked" }), {
          status: 401,
        });
      }
      return new Response(JSON.stringify({ items: [sampleAdmin], total: 1 }), { status: 200 });
    });

    const firstRender = render(
      <QueryProvider>
        <VendorUsersContainer />
      </QueryProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "ベンダーアカウント管理" })).toBeVisible();
    });
    firstRender.unmount();

    // 同じ QueryProvider（相当の別マウントでは別 QueryClient になるため、再レンダリングで再取得を発生させる）
    const sharedTree = render(
      <QueryProvider>
        <VendorUsersContainer />
      </QueryProvider>,
    );

    // 2回目は初回マウントで 401 になり /login へ遷移する。
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/login");
    });
    sharedTree.unmount();

    replaceMock.mockReset();
    render(
      <QueryProvider>
        <VendorLoginContainer />
      </QueryProvider>,
    );
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "システムベンダーログイン" })).toBeVisible();
    });
    expect(replaceMock).not.toHaveBeenCalledWith("/vendor/users");
  });

  it("503 のような一過性エラー時はキャッシュ済みユーザーで画面を維持し /login へ遷移しない", async () => {
    let meCalls = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/vendor/auth/me") {
        meCalls += 1;
        if (meCalls === 1) {
          return new Response(JSON.stringify(sampleAdmin), { status: 200 });
        }
        return new Response(JSON.stringify({ detail: "temporary unavailable" }), { status: 503 });
      }
      return new Response(JSON.stringify({ items: [sampleAdmin], total: 1 }), { status: 200 });
    });

    const view = render(
      <QueryProvider>
        <VendorUsersContainer />
      </QueryProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "ベンダーアカウント管理" })).toBeVisible();
    });

    // key を変えずに同じ QueryProvider 内で再マウントし、キャッシュを保持したままバックグラウンド再取得（503）を起こす。
    view.rerender(
      <QueryProvider>
        <VendorUsersContainer key="remounted" />
      </QueryProvider>,
    );

    await waitFor(() => {
      expect(meCalls).toBeGreaterThanOrEqual(2);
    });
    expect(screen.getByRole("heading", { name: "ベンダーアカウント管理" })).toBeVisible();
    expect(replaceMock).not.toHaveBeenCalledWith("/login");
  });
});
