import {
  ApiError,
  type ApiJsonResponse,
  type ApiMethodForPath,
  type ApiPath,
  type ApiRequestOptions,
  apiRequest,
} from "@/shared/lib/api/apiClient";
import { parseZodResponse } from "@/shared/lib/api/zodResponse";
import {
  type VendorAuthSession,
  type VendorRole,
  type VendorUser,
  type VendorUserList,
  vendorAuthSessionSchema,
  vendorUserListSchema,
  vendorUserSchema,
} from "./schemas";

const CSRF_HEADERS: HeadersInit = {
  "X-Requested-With": "XMLHttpRequest",
};

export const VENDOR_AUTH_LAST_REFRESH_KEY = "vendor_auth_last_refresh_at";
export const VENDOR_AUTH_REFRESH_LOCK_NAME = "vendor-auth-refresh-lock";

let refreshInFlight: Promise<VendorAuthSession | null> | null = null;

/** 401 認証エラーかどうかを判定する（5xx やネットワーク障害とは区別する）。 */
export function isAuthenticationError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

function readLastRefreshTimestamp(): number {
  try {
    const raw = globalThis.localStorage?.getItem(VENDOR_AUTH_LAST_REFRESH_KEY);
    if (!raw) return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function writeLastRefreshTimestamp(timestampMs: number): void {
  try {
    globalThis.localStorage?.setItem(VENDOR_AUTH_LAST_REFRESH_KEY, String(timestampMs));
  } catch {
    // プライベートブラウズ等で localStorage が利用不可の場合は無視する。
  }
}

async function runCrossTabRefresh(requestStartedAt: number): Promise<VendorAuthSession | null> {
  const execute = async (): Promise<VendorAuthSession | null> => {
    if (readLastRefreshTimestamp() >= requestStartedAt) {
      // ロック待機中に別タブがすでに新しいトークンへ更新済みの場合は重複送信しない。
      return null;
    }
    const session = await apiRequest("/api/vendor/auth/refresh", {
      method: "post",
      headers: CSRF_HEADERS,
      parse: (data) => parseZodResponse(vendorAuthSessionSchema, data),
    });
    writeLastRefreshTimestamp(Date.now());
    return session;
  };

  const lockManager = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (lockManager && typeof lockManager.request === "function") {
    return lockManager.request(VENDOR_AUTH_REFRESH_LOCK_NAME, execute);
  }
  return execute();
}

/** 並列 401 応答およびマルチタブ間でリフレッシュ API を協調実行する。 */
export function refreshVendorSessionSingleFlight(
  requestStartedAt = Date.now(),
): Promise<VendorAuthSession | null> {
  if (!refreshInFlight) {
    refreshInFlight = runCrossTabRefresh(requestStartedAt).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/**
 * 認証付きベンダー API を呼び出し、401 時は 1 回だけリフレッシュを試行して再実行する。
 */
export async function vendorAuthApiRequest<P extends ApiPath, M extends ApiMethodForPath<P>>(
  path: P,
  options: ApiRequestOptions<P, M>,
): Promise<ApiJsonResponse<P, M>> {
  const mergedHeaders = new Headers(options.headers);
  if (options.method.toLowerCase() !== "get" && !mergedHeaders.has("X-Requested-With")) {
    mergedHeaders.set("X-Requested-With", "XMLHttpRequest");
  }

  const requestStartedAt = Date.now();
  try {
    return await apiRequest(path, {
      ...options,
      headers: mergedHeaders,
    } as ApiRequestOptions<P, M>);
  } catch (error) {
    if (isAuthenticationError(error)) {
      await refreshVendorSessionSingleFlight(requestStartedAt);
      return apiRequest(path, {
        ...options,
        headers: mergedHeaders,
      } as ApiRequestOptions<P, M>);
    }
    throw error;
  }
}

export function loginVendorUser(input: {
  email: string;
  password: string;
}): Promise<VendorAuthSession> {
  return apiRequest("/api/vendor/auth/login", {
    method: "post",
    headers: CSRF_HEADERS,
    body: input,
    parse: (data) => parseZodResponse(vendorAuthSessionSchema, data),
  });
}

export function logoutVendorUser(): Promise<void> {
  return apiRequest("/api/vendor/auth/logout", {
    method: "post",
    headers: CSRF_HEADERS,
  });
}

export function fetchCurrentVendorUser(signal?: AbortSignal): Promise<VendorUser> {
  return vendorAuthApiRequest("/api/vendor/auth/me", {
    method: "get",
    signal,
    parse: (data) => parseZodResponse(vendorUserSchema, data),
  });
}

export function fetchVendorUsers(signal?: AbortSignal): Promise<VendorUserList> {
  return vendorAuthApiRequest("/api/vendor/users", {
    method: "get",
    signal,
    parse: (data) => parseZodResponse(vendorUserListSchema, data),
  });
}

export function createVendorUser(input: {
  email: string;
  display_name: string;
  role: VendorRole;
  password: string;
}): Promise<VendorUser> {
  return vendorAuthApiRequest("/api/vendor/users", {
    method: "post",
    headers: CSRF_HEADERS,
    body: input,
    parse: (data) => parseZodResponse(vendorUserSchema, data),
  });
}
