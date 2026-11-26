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
  type AffiliationType,
  type AuthSession,
  type AuthUser,
  type AuthUserList,
  authSessionSchema,
  authUserListSchema,
  authUserSchema,
  type VendorAssignableRole,
} from "./schemas";

const CSRF_HEADERS: HeadersInit = {
  "X-Requested-With": "XMLHttpRequest",
};

export const AUTH_LAST_REFRESH_KEY = "auth_last_refresh_at";
export const AUTH_REFRESH_LOCK_NAME = "auth-refresh-lock";

let refreshInFlight: Promise<AuthSession | null> | null = null;

/** 401 認証エラーかどうかを判定する（5xx やネットワーク障害とは区別する）。 */
export function isAuthenticationError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

function readLastRefreshTimestamp(): number {
  try {
    const raw = globalThis.localStorage?.getItem(AUTH_LAST_REFRESH_KEY);
    if (!raw) return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function writeLastRefreshTimestamp(timestampMs: number): void {
  try {
    globalThis.localStorage?.setItem(AUTH_LAST_REFRESH_KEY, String(timestampMs));
  } catch {
    // プライベートブラウズ等で localStorage が利用不可の場合は無視する。
  }
}

async function runCrossTabRefresh(requestStartedAt: number): Promise<AuthSession | null> {
  const execute = async (): Promise<AuthSession | null> => {
    if (readLastRefreshTimestamp() >= requestStartedAt) {
      // ロック待機中に別タブがすでに新しいトークンへ更新済みの場合は重複送信しない。
      return null;
    }
    const session = await apiRequest("/api/auth/refresh", {
      method: "post",
      headers: CSRF_HEADERS,
      parse: (data) => parseZodResponse(authSessionSchema, data),
    });
    writeLastRefreshTimestamp(Date.now());
    return session;
  };

  const lockManager = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (lockManager && typeof lockManager.request === "function") {
    return lockManager.request(AUTH_REFRESH_LOCK_NAME, execute);
  }
  return execute();
}

/** 並列 401 応答およびマルチタブ間でリフレッシュ API を協調実行する。 */
export function refreshAuthSessionSingleFlight(
  requestStartedAt = Date.now(),
): Promise<AuthSession | null> {
  if (!refreshInFlight) {
    refreshInFlight = runCrossTabRefresh(requestStartedAt).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/**
 * 認証付き API を呼び出し、401 時は 1 回だけリフレッシュを試行して再実行する。
 */
export async function authApiRequest<P extends ApiPath, M extends ApiMethodForPath<P>>(
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
      await refreshAuthSessionSingleFlight(requestStartedAt);
      return apiRequest(path, {
        ...options,
        headers: mergedHeaders,
      } as ApiRequestOptions<P, M>);
    }
    throw error;
  }
}

export function loginAuthUser(input: {
  email: string;
  password: string;
  scope_type?: AffiliationType;
  tenant_id?: string | null;
}): Promise<AuthSession> {
  return apiRequest("/api/auth/login", {
    method: "post",
    headers: CSRF_HEADERS,
    body: input,
    parse: (data) => parseZodResponse(authSessionSchema, data),
  });
}

export function logoutAuthUser(): Promise<void> {
  return apiRequest("/api/auth/logout", {
    method: "post",
    headers: CSRF_HEADERS,
  });
}

export function fetchCurrentAuthUser(signal?: AbortSignal): Promise<AuthUser> {
  return authApiRequest("/api/auth/me", {
    method: "get",
    signal,
    parse: (data) => parseZodResponse(authUserSchema, data),
  });
}

export function fetchVendorUsers(signal?: AbortSignal): Promise<AuthUserList> {
  return authApiRequest("/api/vendor/users", {
    method: "get",
    signal,
    parse: (data) => parseZodResponse(authUserListSchema, data),
  });
}

export function createVendorUser(input: {
  email: string;
  display_name: string;
  roles: VendorAssignableRole[];
  password: string;
}): Promise<AuthUser> {
  return authApiRequest("/api/vendor/users", {
    method: "post",
    headers: CSRF_HEADERS,
    body: input,
    parse: (data) => parseZodResponse(authUserSchema, data),
  });
}
