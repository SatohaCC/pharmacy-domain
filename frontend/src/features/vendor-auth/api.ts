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

let refreshInFlight: Promise<VendorAuthSession> | null = null;

/** 並列 401 応答時にリフレッシュ API を単一フライトへ集約して実行する。 */
export function refreshVendorSessionSingleFlight(): Promise<VendorAuthSession> {
  if (!refreshInFlight) {
    refreshInFlight = apiRequest("/api/vendor/auth/refresh", {
      method: "post",
      headers: CSRF_HEADERS,
      parse: (data) => parseZodResponse(vendorAuthSessionSchema, data),
    }).finally(() => {
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

  try {
    return await apiRequest(path, {
      ...options,
      headers: mergedHeaders,
    } as ApiRequestOptions<P, M>);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await refreshVendorSessionSingleFlight();
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
