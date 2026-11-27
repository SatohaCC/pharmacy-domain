"use client";

import * as stylex from "@stylexjs/stylex";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isAuthenticationError } from "@/features/auth/api";
import { useAuthLogout, useClearAuthCache, useCurrentAuthUser } from "@/features/auth/useAuth";
import { ApiError } from "@/shared/lib/api/apiClient";
import { Spinner } from "@/shared/ui/spinner/Spinner";
import { CorporationsWorkspace } from "./CorporationsWorkspace";
import { corporationsWorkspaceStyles as s } from "./CorporationsWorkspace.styles";
import type { Corporation, CorporationListFilter } from "./schemas";
import {
  useChangeCorporationStatus,
  useChangeCorporationUsageStatus,
  useCorporationAt,
  useCorporationHistory,
  useCorporations,
  useCorrectCorporationHistory,
  useCreateCorporation,
  useUpdateCorporation,
} from "./useCorporations";

/** 導入企業（法人・個人開設者）管理画面のコンテナ。未認証・認証失効時はキャッシュを削除して /login へ遷移する。 */
export function CorporationsContainer() {
  const router = useRouter();
  const clearAuthCache = useClearAuthCache();
  const currentUserQuery = useCurrentAuthUser();
  const [filter, setFilter] = useState<CorporationListFilter>({});
  const [selectedHistoryCorpId, setSelectedHistoryCorpId] = useState<string | null>(null);
  const [snapshotParams, setSnapshotParams] = useState<{
    as_of?: string;
    recorded_as_of?: string;
  } | null>(null);

  const isVendorUser = currentUserQuery.data?.affiliation_type === "vendor";
  const corporationsQuery = useCorporations(filter, Boolean(isVendorUser));
  const activeCorporationsQuery = useCorporations({ status: "active" }, Boolean(isVendorUser));
  const historyQuery = useCorporationHistory(
    selectedHistoryCorpId ?? "",
    Boolean(isVendorUser && selectedHistoryCorpId),
  );
  const snapshotQuery = useCorporationAt(
    selectedHistoryCorpId ?? "",
    snapshotParams ?? {},
    Boolean(isVendorUser && selectedHistoryCorpId && snapshotParams),
  );
  const createMutation = useCreateCorporation();
  const updateMutation = useUpdateCorporation();
  const changeStatusMutation = useChangeCorporationStatus();
  const changeUsageStatusMutation = useChangeCorporationUsageStatus();
  const correctHistoryMutation = useCorrectCorporationHistory();
  const logoutMutation = useAuthLogout(() => {
    router.replace("/login");
  });

  const [lastCreatedCorporation, setLastCreatedCorporation] = useState<Corporation | null>(null);
  const [lastUpdatedCorporation, setLastUpdatedCorporation] = useState<Corporation | null>(null);

  const hasSessionAuthError =
    currentUserQuery.isAuthError ||
    isAuthenticationError(corporationsQuery.error) ||
    isAuthenticationError(activeCorporationsQuery.error) ||
    isAuthenticationError(historyQuery.error) ||
    isAuthenticationError(snapshotQuery.error) ||
    isAuthenticationError(createMutation.error) ||
    isAuthenticationError(updateMutation.error) ||
    isAuthenticationError(changeStatusMutation.error) ||
    isAuthenticationError(changeUsageStatusMutation.error) ||
    isAuthenticationError(correctHistoryMutation.error);

  useEffect(() => {
    if (hasSessionAuthError) {
      clearAuthCache();
      router.replace("/login");
      return;
    }
    if (!currentUserQuery.isLoading && !currentUserQuery.data) {
      router.replace("/login");
    }
  }, [
    clearAuthCache,
    currentUserQuery.data,
    currentUserQuery.isLoading,
    hasSessionAuthError,
    router,
  ]);

  if (currentUserQuery.isLoading || hasSessionAuthError || !currentUserQuery.data) {
    return (
      <div {...stylex.props(s.loadingBox)}>
        <Spinner size="lg" label="認証状態を確認中…" showLabel />
      </div>
    );
  }

  const createUserFacingError =
    createMutation.error instanceof ApiError ? createMutation.error.userFacing : null;
  const updateUserFacingError =
    updateMutation.error instanceof ApiError ? updateMutation.error.userFacing : null;

  return (
    <CorporationsWorkspace
      currentUser={currentUserQuery.data}
      corporations={corporationsQuery.data?.items ?? []}
      totalCount={corporationsQuery.data?.total ?? 0}
      filter={filter}
      onFilterChange={setFilter}
      isLoadingCorporations={corporationsQuery.isLoading}
      isFetchingCorporations={corporationsQuery.isFetching}
      corporationsErrorMessage={corporationsQuery.errorMessage}
      isCreatingCorporation={createMutation.isPending}
      createErrorMessage={createMutation.errorMessage}
      createUserFacingError={createUserFacingError}
      lastCreatedCorporation={lastCreatedCorporation}
      onDismissCreatedBanner={() => setLastCreatedCorporation(null)}
      onCreateCorporation={async (input) => {
        try {
          const created = await createMutation.mutateAsync(input);
          setLastCreatedCorporation(created);
          return true;
        } catch {
          return false;
        }
      }}
      isUpdatingCorporation={updateMutation.isPending}
      updateErrorMessage={updateMutation.errorMessage}
      updateUserFacingError={updateUserFacingError}
      lastUpdatedCorporation={lastUpdatedCorporation}
      onDismissUpdatedBanner={() => setLastUpdatedCorporation(null)}
      onUpdateCorporation={async (corporationId, payload) => {
        try {
          const updated = await updateMutation.mutateAsync({ corporationId, payload });
          setLastUpdatedCorporation(updated);
          return true;
        } catch {
          return false;
        }
      }}
      isLoggingOut={logoutMutation.isPending}
      onLogout={() => {
        logoutMutation.mutate();
      }}
      selectedHistoryCorpId={selectedHistoryCorpId}
      onSelectHistoryCorp={(corporationId) => {
        setSelectedHistoryCorpId(corporationId);
        setSnapshotParams(null);
      }}
      activeCorporations={activeCorporationsQuery.data?.items ?? []}
      historyRecords={historyQuery.data ?? []}
      isLoadingHistory={historyQuery.isLoading}
      historyErrorMessage={historyQuery.errorMessage}
      snapshotParams={snapshotParams}
      onLookupSnapshot={setSnapshotParams}
      snapshotCorporation={snapshotParams ? (snapshotQuery.data ?? null) : null}
      isLoadingSnapshot={snapshotQuery.isFetching}
      snapshotErrorMessage={snapshotParams ? snapshotQuery.errorMessage : null}
      isChangingStatus={changeStatusMutation.isPending}
      statusErrorMessage={changeStatusMutation.errorMessage}
      onChangeStatus={async (corporationId, payload) => {
        try {
          const updated = await changeStatusMutation.mutateAsync({ corporationId, payload });
          setLastUpdatedCorporation(updated);
          return true;
        } catch {
          return false;
        }
      }}
      isChangingUsageStatus={changeUsageStatusMutation.isPending}
      onChangeUsageStatus={async (corporationId, usageStatus) => {
        try {
          const updated = await changeUsageStatusMutation.mutateAsync({
            corporationId,
            usageStatus,
          });
          setLastUpdatedCorporation(updated);
          return true;
        } catch {
          return false;
        }
      }}
      isCorrectingHistory={correctHistoryMutation.isPending}
      correctionErrorMessage={correctHistoryMutation.errorMessage}
      onCorrectHistory={async (corporationId, payload) => {
        try {
          await correctHistoryMutation.mutateAsync({ corporationId, payload });
          return true;
        } catch {
          return false;
        }
      }}
    />
  );
}
