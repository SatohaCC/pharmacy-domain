import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildBackendUrl,
  pickForwardHeaders,
  resolveBackendOrigin,
  serverApiRequest,
} from "./serverApiClient";

describe("resolveBackendOrigin", () => {
  it("BACKEND_URL が設定されていれば末尾スラッシュを除いて返す", () => {
    expect(resolveBackendOrigin({ BACKEND_URL: "https://api.example.com/" })).toBe(
      "https://api.example.com",
    );
  });

  it("非本番環境で BACKEND_URL 未設定なら開発デフォルト URL を返す", () => {
    expect(resolveBackendOrigin({ NODE_ENV: "development" })).toBe("http://127.0.0.1:8000");
  });

  it("本番環境で BACKEND_URL 未設定時は VERCEL_URL を使い、それも無ければエラーを投げる", () => {
    expect(resolveBackendOrigin({ NODE_ENV: "production", VERCEL_URL: "app.vercel.app/" })).toBe(
      "https://app.vercel.app",
    );
    expect(() => resolveBackendOrigin({ NODE_ENV: "production" })).toThrow(
      "BACKEND_URL が未設定のためサーバー側から Backend API を呼び出せません。",
    );
  });
});

describe("buildBackendUrl", () => {
  it("ベースオリジンとパスを安全に結合する", () => {
    expect(buildBackendUrl("api/health", { baseOrigin: "http://127.0.0.1:8000/" })).toBe(
      "http://127.0.0.1:8000/api/health",
    );
  });
});

describe("pickForwardHeaders", () => {
  it("許可リストのヘッダーのみ抽出し、追加ヘッダーで上書きできる", () => {
    const result = pickForwardHeaders(
      {
        "X-Request-ID": "req-abc",
        Cookie: "session=xyz",
        Host: "evil.example.com",
        "Content-Length": "999",
      },
      { "X-Request-ID": "req-override", "X-Custom": "1" },
    );

    expect(result.get("x-request-id")).toBe("req-override");
    expect(result.get("cookie")).toBe("session=xyz");
    expect(result.get("x-custom")).toBe("1");
    expect(result.has("host")).toBe(false);
    expect(result.has("content-length")).toBe(false);
  });
});

describe("serverApiRequest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("解決したオリジンと許可済みヘッダーで Backend API を呼び出す", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "ok", service: "template-backend" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const data = await serverApiRequest("/api/health", {
      method: "get",
      env: { BACKEND_URL: "http://127.0.0.1:8000/" },
      incomingHeaders: {
        "x-request-id": "req-rsc-1",
        host: "localhost:3000",
      },
      parse: (raw) => raw as { status: "ok"; service: string },
    });

    expect(data).toEqual({ status: "ok", service: "template-backend" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:8000/api/health");
    const sentHeaders = new Headers(init?.headers);
    expect(sentHeaders.get("x-request-id")).toBe("req-rsc-1");
    expect(sentHeaders.has("host")).toBe(false);
  });
});
