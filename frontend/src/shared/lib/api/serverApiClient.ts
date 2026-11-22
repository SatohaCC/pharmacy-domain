import {
  type ApiJsonResponse,
  type ApiMethodForPath,
  type ApiPath,
  type ApiRequestOptions,
  apiRequest,
} from "./apiClient";

const DEFAULT_FORWARD_HEADERS = [
  "x-request-id",
  "cookie",
  "authorization",
  "accept-language",
] as const;

export interface BackendOriginOptions {
  env?: Record<string, string | undefined>;
}

/** Server Component / Route Handler から参照する Backend オリジン URL を解決する。 */
export function resolveBackendOrigin(
  env: Record<string, string | undefined> = process.env,
): string {
  const configured = env.BACKEND_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  if (env.NODE_ENV !== "production") {
    return "http://127.0.0.1:8000";
  }
  const vercelUrl = env.VERCEL_URL?.trim();
  if (vercelUrl) {
    const withScheme = /^https?:\/\//i.test(vercelUrl) ? vercelUrl : `https://${vercelUrl}`;
    return withScheme.replace(/\/+$/, "");
  }
  throw new Error("BACKEND_URL が未設定のためサーバー側から Backend API を呼び出せません。");
}

/** Backend オリジンと API パスを結合した完全 URL を組み立てる。 */
export function buildBackendUrl(
  path: string,
  options?: BackendOriginOptions & { baseOrigin?: string },
): string {
  const origin = options?.baseOrigin?.trim()
    ? options.baseOrigin.trim().replace(/\/+$/, "")
    : resolveBackendOrigin(options?.env);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${normalizedPath}`;
}

/** 受信リクエストヘッダーから安全な許可リスト項目のみを抽出し、追加ヘッダーと合成する。 */
export function pickForwardHeaders(
  incoming?: HeadersInit,
  extra?: HeadersInit,
  allowList: readonly string[] = DEFAULT_FORWARD_HEADERS,
): Headers {
  const allowed = new Set(allowList.map((name) => name.toLowerCase()));
  const resolved = new Headers();

  if (incoming) {
    const source = new Headers(incoming);
    source.forEach((value, key) => {
      if (allowed.has(key.toLowerCase()) && value.trim()) {
        resolved.set(key, value);
      }
    });
  }

  if (extra) {
    new Headers(extra).forEach((value, key) => {
      resolved.set(key, value);
    });
  }

  return resolved;
}

export type ServerApiRequestOptions<P extends ApiPath, M extends ApiMethodForPath<P>> = Omit<
  ApiRequestOptions<P, M>,
  "baseUrl"
> & {
  incomingHeaders?: HeadersInit;
  env?: Record<string, string | undefined>;
  baseOrigin?: string;
};

/** サーバー側（RSC / Route Handler）から OpenAPI 型付きで Backend API を呼び出す。 */
export function serverApiRequest<P extends ApiPath, M extends ApiMethodForPath<P>>(
  path: P,
  options: ServerApiRequestOptions<P, M>,
): Promise<ApiJsonResponse<P, M>> {
  const { incomingHeaders, env, baseOrigin, headers, ...rest } = options as ServerApiRequestOptions<
    P,
    M
  > & {
    headers?: HeadersInit;
  };
  const resolvedOrigin = baseOrigin?.trim()
    ? baseOrigin.trim().replace(/\/+$/, "")
    : resolveBackendOrigin(env);
  const forwardedHeaders = pickForwardHeaders(incomingHeaders, headers);

  return apiRequest(path, {
    ...rest,
    baseUrl: resolvedOrigin,
    headers: forwardedHeaders,
  } as ApiRequestOptions<P, M>);
}
