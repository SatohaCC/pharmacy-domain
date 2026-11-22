"use client";

import { apiRequest } from "@/shared/lib/api/apiClient";
import type { components } from "@/shared/lib/api/schema";
import { expectLiteral, expectNonEmptyString, expectRecord } from "@/shared/lib/api/validators";
import { useAppQuery } from "@/shared/lib/query/useAppQuery";

export type HealthResponse = components["schemas"]["HealthResponse"];

function parseHealthResponse(data: unknown): HealthResponse {
  const record = expectRecord(data, "Invalid health response");
  return {
    status: expectLiteral(record.status, "ok", "Invalid health response"),
    service: expectNonEmptyString(record.service, "Invalid health response"),
  };
}

function fetchHealth(signal: AbortSignal): Promise<HealthResponse> {
  return apiRequest("/api/health", {
    method: "get",
    signal,
    parse: parseHealthResponse,
  });
}

export function useHealthStatus() {
  const { data, errorMessage, isLoading, isFetching, refetch } = useAppQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => fetchHealth(signal),
  });

  return {
    data,
    error: errorMessage,
    isLoading: isLoading || isFetching,
    onRefresh: refetch,
  };
}
