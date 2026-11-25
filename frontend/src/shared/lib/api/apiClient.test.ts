import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetchJson, apiFetchVoid, apiRequest } from "./apiClient";
import type { components } from "./schema";

describe("apiFetchJson", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("正常な JSON レスポンスを parse 結果として返す", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await apiFetchJson("/api/sample", {
      parse: (data) => data as { status: string },
    });

    expect(result).toEqual({ status: "ok" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sample",
      expect.objectContaining({ method: "GET", cache: "no-store" }),
    );
  });

  it("従来の HTTP エラー（code なし）時はステータス付きの ApiError を投げる", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "unavailable" }), {
        status: 503,
        headers: { "X-Request-ID": "req-503" },
      }),
    );

    const promise = apiFetchJson("/api/sample", { parse: (data) => data });

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({
      message: "HTTP 503",
      status: 503,
      code: "HTTP_ERROR",
      errorCode: null,
      detail: "unavailable",
      requestId: "req-503",
    });
  });

  it("Backend の共通 ErrorResponse（code/detail/errors）と X-Request-ID を保持する", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "VALIDATION_ERROR",
          detail: "入力内容に誤りがあります",
          errors: [{ loc: ["body", "name"], msg: "Field required", type: "missing" }],
        }),
        {
          status: 422,
          headers: {
            "Content-Type": "application/json",
            "X-Request-ID": "req-422-trace",
          },
        },
      ),
    );

    const promise = apiFetchJson("/api/sample", { parse: (data) => data });

    await expect(promise).rejects.toMatchObject({
      message: "入力内容に誤りがあります",
      status: 422,
      code: "HTTP_ERROR",
      errorCode: "VALIDATION_ERROR",
      detail: "入力内容に誤りがあります",
      requestId: "req-422-trace",
      errors: [{ loc: ["body", "name"], msg: "Field required", type: "missing" }],
      userFacing: null,
    });
  });

  it("5要素 ErrorResponse を userFacing としてパースし、不正な action_type や非スカラー details を安全に除外する", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "FORBIDDEN_SEPARATOR_IN_INSURANCE_ID",
          title: "保険資格を登録できませんでした",
          reassurance: "既存のデータは変更されていません。",
          reason: "記号・番号に空白が含まれています。",
          how_to_fix: "空白を取り除いて再度入力してください。",
          way_out: "サポート窓口へお問い合わせください。",
          actions: [
            { label: "入力を修正する", action_type: "fix_input" },
            { label: "未知アクション", action_type: "unknown_action" },
          ],
          details: {
            field: "insurance_number",
            nested: { secret: "ignored" },
          },
        }),
        {
          status: 422,
          headers: {
            "Content-Type": "application/json",
            "X-Request-ID": "req-five-elements",
          },
        },
      ),
    );

    const promise = apiFetchJson("/api/sample", { parse: (data) => data });

    await expect(promise).rejects.toMatchObject({
      message: "記号・番号に空白が含まれています。",
      status: 422,
      code: "HTTP_ERROR",
      errorCode: "FORBIDDEN_SEPARATOR_IN_INSURANCE_ID",
      detail: "記号・番号に空白が含まれています。",
      requestId: "req-five-elements",
      userFacing: {
        title: "保険資格を登録できませんでした",
        reassurance: "既存のデータは変更されていません。",
        reason: "記号・番号に空白が含まれています。",
        how_to_fix: "空白を取り除いて再度入力してください。",
        way_out: "サポート窓口へお問い合わせください。",
        actions: [{ label: "入力を修正する", action_type: "fix_input" }],
        details: { field: "insurance_number" },
      },
    });
  });

  it("JSON パースに失敗した場合や 204 空応答の場合は INVALID_RESPONSE を投げる", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response("not-json", { status: 200, headers: { "X-Request-ID": "req-bad-json" } }),
      )
      .mockResolvedValueOnce(
        new Response(null, { status: 204, headers: { "X-Request-ID": "req-empty" } }),
      );

    await expect(apiFetchJson("/api/sample", { parse: (data) => data })).rejects.toMatchObject({
      message: "Invalid JSON response",
      status: 200,
      code: "INVALID_RESPONSE",
      requestId: "req-bad-json",
    });

    await expect(apiFetchJson("/api/sample", { parse: (data) => data })).rejects.toMatchObject({
      message: "Invalid JSON response",
      status: 204,
      code: "INVALID_RESPONSE",
      requestId: "req-empty",
    });
  });

  it("parse が投げた ApiError に HTTP ステータスと X-Request-ID を補完する", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "ng" }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": "req-parse-fail",
        },
      }),
    );

    const promise = apiFetchJson("/api/sample", {
      parse: () => {
        throw new ApiError("Invalid payload", { code: "INVALID_RESPONSE" });
      },
    });

    await expect(promise).rejects.toMatchObject({
      message: "Invalid payload",
      status: 200,
      code: "INVALID_RESPONSE",
      requestId: "req-parse-fail",
    });
  });
});

describe("apiFetchVoid", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("204 No Content 応答をエラーなく処理できる", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    await expect(apiFetchVoid("/api/items/1", { method: "DELETE" })).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/items/1",
      expect.objectContaining({ method: "DELETE", cache: "no-store" }),
    );
  });

  it("エラー応答時は Backend 構造化エラーと X-Request-ID を含む ApiError を投げる", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ code: "NOT_FOUND", detail: "対象が見つかりません" }), {
        status: 404,
        headers: { "X-Request-ID": "req-404" },
      }),
    );

    await expect(apiFetchVoid("/api/items/1", { method: "DELETE" })).rejects.toMatchObject({
      message: "対象が見つかりません",
      status: 404,
      code: "HTTP_ERROR",
      errorCode: "NOT_FOUND",
      requestId: "req-404",
    });
  });
});

describe("apiRequest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("OpenAPI paths の型に従って API を呼び出せる", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "ok", service: "template-backend" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const data = await apiRequest("/api/health", {
      method: "get",
      query: { check: true, empty: null },
      parse: (raw) => raw as { status: "ok"; service: string },
    });

    expect(data).toEqual({ status: "ok", service: "template-backend" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/health?check=true",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("パスパラメータ付き OpenAPI パスを展開・URL エンコードして呼び出せる", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "corp/1 2" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await apiRequest("/api/corporations/{corporation_id}", {
      method: "get",
      params: { corporation_id: "corp/1 2" },
      parse: (raw) => raw as components["schemas"]["CorporationResponse"],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/corporations/corp%2F1%202",
      expect.objectContaining({ method: "GET", cache: "no-store" }),
    );
  });

  it("存在しないパス・未定義メソッド・パスパラメータ不整合を型レベルで検知できる", () => {
    const verifyTypeConstraints = () => {
      // @ts-expect-error OpenAPI schema に存在しないパスは許可しない
      void apiRequest("/api/non-existent", { method: "get", parse: (raw) => raw });
      // @ts-expect-error /api/health に定義されていない HTTP メソッドは許可しない
      void apiRequest("/api/health", { method: "post", parse: (raw) => raw });
      // @ts-expect-error {corporation_id} パラメータが必須のパスで params 欠落は許可しない
      void apiRequest("/api/corporations/{corporation_id}", {
        method: "get",
        parse: (raw) => raw as components["schemas"]["CorporationResponse"],
      });
      // @ts-expect-error パスパラメータのないパスで params 指定は許可しない
      void apiRequest("/api/health", { method: "get", params: { id: "1" }, parse: (raw) => raw });
    };

    expect(typeof verifyTypeConstraints).toBe("function");
  });
});
