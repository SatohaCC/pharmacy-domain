"use client";

import { StatusCard } from "@/shared/components/status-card/StatusCard";
import { type HealthResponse, useHealthStatus } from "./useHealthStatus";

function toBadge(data: HealthResponse | null, error: string | null, isLoading: boolean) {
  if (isLoading) return { tone: "neutral" as const, text: "確認中…" };
  if (error) return { tone: "danger" as const, text: `エラー: ${error}` };
  if (data) return { tone: "success" as const, text: `${data.status} (${data.service})` };
  return { tone: "neutral" as const, text: "不明" };
}

export function HealthStatusContainer() {
  const { data, error, isLoading, onRefresh } = useHealthStatus();
  const badge = toBadge(data, error, isLoading);

  return (
    <StatusCard
      label="バックエンド API"
      badgeText={badge.text}
      badgeTone={badge.tone}
      actionLabel={isLoading ? "確認中…" : "状態を更新"}
      isActionDisabled={isLoading}
      onAction={onRefresh}
    />
  );
}
