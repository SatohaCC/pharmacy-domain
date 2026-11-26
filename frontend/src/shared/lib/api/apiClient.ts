import type { paths } from "./schema";

export type ApiErrorCode = "HTTP_ERROR" | "INVALID_RESPONSE";

export type ApiErrorActionType =
  | "cancel"
  | "retry"
  | "fix_input"
  | "reload"
  | "go_back"
  | "save_draft"
  | "contact_support";

export interface ApiErrorAction {
  label: string;
  action_type: ApiErrorActionType;
}

export type ApiErrorDetailScalar = string | number | boolean | null;

export interface ApiUserFacingError {
  title: string;
  reassurance: string;
  reason: string;
  how_to_fix: string;
  way_out: string;
  actions: readonly ApiErrorAction[];
  details: Readonly<Record<string, ApiErrorDetailScalar>> | null;
}

export interface ApiValidationError {
  loc: readonly (string | number)[];
  msg: string;
  type: string;
}

export interface ApiErrorOptions {
  status?: number | null;
  code: ApiErrorCode;
  errorCode?: string | null;
  detail?: string | null;
  requestId?: string | null;
  errors?: readonly ApiValidationError[] | null;
  userFacing?: ApiUserFacingError | null;
  cause?: unknown;
}

/** HTTP ステータスやレスポンス検証失敗、Backend 構造化エラーを表す共通エラー。 */
export class ApiError extends Error {
  readonly status: number | null;
  readonly code: ApiErrorCode;
  readonly errorCode: string | null;
  readonly detail: string | null;
  readonly requestId: string | null;
  readonly errors: readonly ApiValidationError[] | null;
  readonly userFacing: ApiUserFacingError | null;

  constructor(
    message: string,
    {
      status = null,
      code,
      errorCode = null,
      detail = null,
      requestId = null,
      errors = null,
      userFacing = null,
      cause,
    }: ApiErrorOptions,
  ) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.errorCode = errorCode;
    this.detail = detail;
    this.requestId = requestId;
    this.errors = errors;
    this.userFacing = userFacing;
  }
}

export interface ApiFetchBaseOptions {
  signal?: AbortSignal;
  method?: string;
  body?: unknown;
  headers?: HeadersInit;
  cache?: RequestCache;
}

export interface ApiFetchJsonOptions<T> extends ApiFetchBaseOptions {
  parse: (data: unknown) => T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const VALID_ACTION_TYPES = new Set<string>([
  "cancel",
  "retry",
  "fix_input",
  "reload",
  "go_back",
  "save_draft",
  "contact_support",
]);

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseErrorActions(raw: unknown): ApiErrorAction[] | null {
  if (!Array.isArray(raw)) {
    return null;
  }
  const actions: ApiErrorAction[] = [];
  for (const item of raw) {
    if (!isPlainObject(item)) {
      continue;
    }
    const label = readNonEmptyString(item.label);
    if (
      !label ||
      typeof item.action_type !== "string" ||
      !VALID_ACTION_TYPES.has(item.action_type)
    ) {
      continue;
    }
    actions.push({
      label,
      action_type: item.action_type as ApiErrorActionType,
    });
  }
  return actions;
}

function parseErrorDetails(raw: unknown): Record<string, ApiErrorDetailScalar> | null {
  if (!isPlainObject(raw)) {
    return null;
  }
  const details: Record<string, ApiErrorDetailScalar> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      details[key] = value;
    }
  }
  return Object.keys(details).length > 0 ? details : null;
}

function parseUserFacingError(parsed: Record<string, unknown>): ApiUserFacingError | null {
  const title = readNonEmptyString(parsed.title);
  const reassurance = readNonEmptyString(parsed.reassurance);
  const reason = readNonEmptyString(parsed.reason);
  const howToFix = readNonEmptyString(parsed.how_to_fix);
  const wayOut = readNonEmptyString(parsed.way_out);
  const actions = parseErrorActions(parsed.actions);

  if (!title || !reassurance || !reason || !howToFix || !wayOut || actions === null) {
    return null;
  }

  return {
    title,
    reassurance,
    reason,
    how_to_fix: howToFix,
    way_out: wayOut,
    actions,
    details: parseErrorDetails(parsed.details),
  };
}

function parseValidationErrors(raw: unknown): ApiValidationError[] | null {
  if (!Array.isArray(raw)) {
    return null;
  }
  const parsed: ApiValidationError[] = [];
  for (const item of raw) {
    if (!isPlainObject(item)) continue;
    if (!Array.isArray(item.loc) || typeof item.msg !== "string" || typeof item.type !== "string") {
      continue;
    }
    const loc = item.loc.filter(
      (part): part is string | number => typeof part === "string" || typeof part === "number",
    );
    parsed.push({ loc, msg: item.msg, type: item.type });
  }
  return parsed.length > 0 ? parsed : null;
}

async function buildHttpApiError(response: Response): Promise<ApiError> {
  const requestId = response.headers.get("X-Request-ID")?.trim() || null;
  let errorCode: string | null = null;
  let detail: string | null = null;
  let errors: ApiValidationError[] | null = null;
  let userFacing: ApiUserFacingError | null = null;

  try {
    const rawText = await response.text();
    if (rawText.trim()) {
      const parsed: unknown = JSON.parse(rawText);
      if (isPlainObject(parsed)) {
        if (typeof parsed.code === "string" && parsed.code.trim()) {
          errorCode = parsed.code.trim();
        }
        userFacing = parseUserFacingError(parsed);
        if (typeof parsed.detail === "string" && parsed.detail.trim()) {
          detail = parsed.detail.trim();
        } else if (userFacing) {
          detail = userFacing.reason;
        }
        errors = parseValidationErrors(parsed.errors);
      }
    }
  } catch {
    // エラーレスポンスが非 JSON の場合は HTTP ステータスベースの標準エラーとして扱う。
  }

  const message = errorCode && detail ? detail : `HTTP ${response.status}`;

  return new ApiError(message, {
    status: response.status,
    code: "HTTP_ERROR",
    errorCode,
    detail,
    requestId,
    errors,
    userFacing,
  });
}

async function executeFetch(
  path: string,
  { signal, method = "GET", body, headers, cache = "no-store" }: ApiFetchBaseOptions,
): Promise<Response> {
  const requestHeaders = new Headers(headers);
  if (body !== undefined && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    method,
    signal,
    cache,
    credentials: "same-origin",
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw await buildHttpApiError(response);
  }

  return response;
}

/** JSON API を呼び出し、HTTP エラーの正規化とレスポンス検証を行う。 */
export async function apiFetchJson<T>(
  path: string,
  { parse, ...options }: ApiFetchJsonOptions<T>,
): Promise<T> {
  const response = await executeFetch(path, options);
  const requestId = response.headers.get("X-Request-ID")?.trim() || null;

  let data: unknown;
  try {
    const rawText = await response.text();
    if (!rawText.trim()) {
      throw new Error("Empty response body");
    }
    data = JSON.parse(rawText);
  } catch (error) {
    throw new ApiError("Invalid JSON response", {
      status: response.status,
      code: "INVALID_RESPONSE",
      requestId,
      cause: error,
    });
  }

  try {
    return parse(data);
  } catch (error) {
    if (error instanceof ApiError) {
      throw new ApiError(error.message, {
        status: error.status ?? response.status,
        code: error.code,
        errorCode: error.errorCode,
        detail: error.detail,
        requestId: error.requestId ?? requestId,
        errors: error.errors,
        userFacing: error.userFacing,
        cause: error.cause ?? error,
      });
    }
    throw error;
  }
}

/** 204 No Content などレスポンスボディを返さない API を呼び出す。 */
export async function apiFetchVoid(path: string, options: ApiFetchBaseOptions = {}): Promise<void> {
  await executeFetch(path, options);
}

export type ApiPath = keyof paths;
export type HttpMethod = "get" | "post" | "put" | "patch" | "delete" | "options" | "head";
export type ApiMethodForPath<P extends ApiPath> = Extract<keyof paths[P], HttpMethod>;

type OperationOf<P extends ApiPath, M extends ApiMethodForPath<P>> = paths[P][M];

export type ApiJsonRequestBody<P extends ApiPath, M extends ApiMethodForPath<P>> =
  OperationOf<P, M> extends {
    requestBody: { content: { "application/json": infer TBody } };
  }
    ? TBody
    : OperationOf<P, M> extends {
          requestBody?: { content: { "application/json": infer TBody } };
        }
      ? TBody | undefined
      : undefined;

type SuccessStatusKey =
  | 200
  | 201
  | 202
  | 203
  | 204
  | 206
  | "200"
  | "201"
  | "202"
  | "203"
  | "204"
  | "206";

type ExtractJsonContent<R> = R extends { content: { "application/json": infer TData } }
  ? TData
  : never;

type ExtractSuccessResponses<ResMap> = {
  [K in Extract<keyof ResMap, SuccessStatusKey>]: ExtractJsonContent<ResMap[K]>;
}[Extract<keyof ResMap, SuccessStatusKey>];

export type ApiJsonResponse<P extends ApiPath, M extends ApiMethodForPath<P>> =
  OperationOf<P, M> extends { responses: infer ResMap }
    ? [ExtractSuccessResponses<ResMap>] extends [never]
      ? undefined
      : ExtractSuccessResponses<ResMap>
    : unknown;

type RequestBodyOption<TBody> = [TBody] extends [undefined]
  ? { body?: never }
  : undefined extends TBody
    ? { body?: Exclude<TBody, undefined> }
    : { body: TBody };

export type ApiQueryParams = Record<string, string | number | boolean | null | undefined>;
export type ApiPathParams = Record<string, string | number>;

type ExtractPathParamNames<P extends string> = P extends `${string}{${infer Param}}${infer Rest}`
  ? Param | ExtractPathParamNames<Rest>
  : never;

type PathParamsOption<P extends ApiPath> = [ExtractPathParamNames<P & string>] extends [never]
  ? { params?: never }
  : { params: Record<ExtractPathParamNames<P & string>, string | number> };

export type ApiRequestOptions<P extends ApiPath, M extends ApiMethodForPath<P>> = {
  method: M;
  signal?: AbortSignal;
  headers?: HeadersInit;
  cache?: RequestCache;
  query?: ApiQueryParams;
  baseUrl?: string;
} & PathParamsOption<P> &
  RequestBodyOption<ApiJsonRequestBody<P, M>> &
  ([ApiJsonResponse<P, M>] extends [undefined]
    ? { parse?: never }
    : { parse: (data: unknown) => ApiJsonResponse<P, M> });

function interpolatePathParams(path: string, pathParams?: ApiPathParams): string {
  return path.replace(/\{([^}]+)\}/g, (_match, key: string) => {
    const value = pathParams && Object.hasOwn(pathParams, key) ? pathParams[key] : undefined;
    if (value === undefined) {
      throw new Error(`パスパラメータ "${key}" が指定されていません。`);
    }
    return encodeURIComponent(String(value));
  });
}

function buildRequestUrl(
  path: string,
  baseUrl?: string,
  pathParams?: ApiPathParams,
  query?: ApiQueryParams,
): string {
  const resolvedPath = interpolatePathParams(path, pathParams);
  const normalizedBase = baseUrl ? baseUrl.replace(/\/+$/, "") : "";
  const normalizedPath = resolvedPath.startsWith("/") ? resolvedPath : `/${resolvedPath}`;
  const fullPath = `${normalizedBase}${normalizedPath}`;
  if (!query) {
    return fullPath;
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      params.set(key, String(value));
    }
  }
  const search = params.toString();
  return search ? `${fullPath}?${search}` : fullPath;
}

/** OpenAPI 生成型（paths）に紐づけて型安全に API を呼び出す。 */
export function apiRequest<P extends ApiPath, M extends ApiMethodForPath<P>>(
  path: P,
  options: ApiRequestOptions<P, M>,
): Promise<ApiJsonResponse<P, M>> {
  const {
    method,
    signal,
    headers,
    cache,
    params: pathParams,
    query,
    baseUrl,
    body,
    parse,
  } = options as {
    method: string;
    signal?: AbortSignal;
    headers?: HeadersInit;
    cache?: RequestCache;
    params?: ApiPathParams;
    query?: ApiQueryParams;
    baseUrl?: string;
    body?: unknown;
    parse?: (data: unknown) => ApiJsonResponse<P, M>;
  };

  const url = buildRequestUrl(String(path), baseUrl, pathParams, query);
  const httpMethod = method.toUpperCase();

  if (typeof parse === "function") {
    return apiFetchJson(url, {
      method: httpMethod,
      signal,
      headers,
      cache,
      body,
      parse,
    });
  }

  return apiFetchVoid(url, {
    method: httpMethod,
    signal,
    headers,
    cache,
    body,
  }) as Promise<ApiJsonResponse<P, M>>;
}
