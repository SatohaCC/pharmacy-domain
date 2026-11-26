import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/lib/api/apiClient";
import {
  AUTH_LAST_REFRESH_KEY,
  fetchCurrentAuthUser,
  fetchVendorUsers,
  refreshAuthSessionSingleFlight,
} from "./api";

describe("auth apiClient", () => {
  beforeEach(() => {
    globalThis.localStorage?.removeItem(AUTH_LAST_REFRESH_KEY);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("並列リクエストが401になったときリフレッシュを1回だけ実行して両方リトライする", async () => {
    let meCalls = 0;
    let usersCalls = 0;
    let refreshCalls = 0;

    const sampleUser = {
      id: "user-1",
      email: "admin@vendor.example.com",
      display_name: "管理者",
      affiliation_type: "vendor",
      tenant_id: null,
      roles: ["vendor_admin"],
      status: "active",
      created_at: "2026-11-26T00:00:00Z",
      updated_at: "2026-11-26T00:00:00Z",
    };

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/auth/me") {
        meCalls += 1;
        if (meCalls === 1) {
          return new Response(JSON.stringify({ code: "AUTH_TOKEN_EXPIRED", detail: "expired" }), {
            status: 401,
          });
        }
        return new Response(JSON.stringify(sampleUser), { status: 200 });
      }
      if (url === "/api/vendor/users") {
        usersCalls += 1;
        if (usersCalls === 1) {
          return new Response(JSON.stringify({ code: "AUTH_TOKEN_EXPIRED", detail: "expired" }), {
            status: 401,
          });
        }
        return new Response(JSON.stringify({ items: [sampleUser], total: 1 }), { status: 200 });
      }
      if (url === "/api/auth/refresh") {
        refreshCalls += 1;
        return new Response(
          JSON.stringify({
            user: sampleUser,
            access_token_expires_in_seconds: 1800,
            refresh_token_expires_in_seconds: 28800,
          }),
          { status: 200 },
        );
      }
      return new Response(null, { status: 404 });
    });

    const [me, list] = await Promise.all([fetchCurrentAuthUser(), fetchVendorUsers()]);

    expect(refreshCalls).toBe(1);
    expect(me.email).toBe("admin@vendor.example.com");
    expect(list.total).toBe(1);
  });

  it("リフレッシュも401の場合は ApiError を伝播する", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ code: "UNAUTHORIZED", detail: "unauthorized" }), {
        status: 401,
      }),
    );

    await expect(fetchCurrentAuthUser()).rejects.toBeInstanceOf(ApiError);
  });

  it("別タブがすでにリフレッシュ済みの場合は Web Locks 内でリフレッシュを再送信しない", async () => {
    const requestStartedAt = Date.now();
    globalThis.localStorage.setItem(AUTH_LAST_REFRESH_KEY, String(requestStartedAt + 50));

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const requestLockMock = vi.fn(
      async (_name: string, callback: () => Promise<unknown>) => await callback(),
    );
    vi.stubGlobal("navigator", {
      locks: { request: requestLockMock },
    });

    const result = await refreshAuthSessionSingleFlight(requestStartedAt);

    expect(requestLockMock).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});
