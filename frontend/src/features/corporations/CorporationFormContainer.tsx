"use client";

import * as stylex from "@stylexjs/stylex";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isAuthenticationError } from "@/features/auth/api";
import { useAuthLogout, useClearAuthCache, useCurrentAuthUser } from "@/features/auth/useAuth";
import { VendorConsoleHeader } from "@/features/auth/VendorConsoleHeader";
import { vendorConsoleLayoutStyles as layout } from "@/features/auth/VendorConsoleLayout.styles";
import { ApiError } from "@/shared/lib/api/apiClient";
import { Alert } from "@/shared/ui/alert/Alert";
import { Spinner } from "@/shared/ui/spinner/Spinner";
import { CorporationFormPage } from "./CorporationFormPage";
import { corporationsWorkspaceStyles as s } from "./CorporationsWorkspace.styles";
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

export type CorporationFormContainerProps =
  | { mode: "create" }
  | { mode: "edit"; corporationId: string };

/** 企業の登録・編集・状態管理画面のコンテナ。未認証・認証失効時は /login へ遷移する。 */
export function CorporationFormContainer(props: CorporationFormContainerProps) {
  const router = useRouter();
  const clearAuthCache = useClearAuthCache();
  const currentUserQuery = useCurrentAuthUser();
  const [snapshotParams, setSnapshotParams] = useState<{
    as_of?: string;
    recorded_as_of?: string;
  } | null>(null);

  const isVendorUser = currentUserQuery.data?.affiliation_type === "vendor";
  const isEditMode = props.mode === "edit";
  const editCorporationId = isEditMode ? props.corporationId : "";
  const corporationQuery = useCorporationAt(
    editCorporationId,
    {},
    Boolean(isVendorUser && isEditMode && editCorporationId),
  );
  const activeCorporationsQuery = useCorporations(
    { status: "active" },
    Boolean(isVendorUser && isEditMode),
  );
  const historyQuery = useCorporationHistory(
    editCorporationId,
    Boolean(isVendorUser && isEditMode && editCorporationId),
  );
  const snapshotQuery = useCorporationAt(
    editCorporationId,
    snapshotParams ?? {},
    Boolean(isVendorUser && isEditMode && editCorporationId && snapshotParams),
  );

  const createMutation = useCreateCorporation();
  const updateMutation = useUpdateCorporation();
  const changeStatusMutation = useChangeCorporationStatus();
  const changeUsageStatusMutation = useChangeCorporationUsageStatus();
  const correctHistoryMutation = useCorrectCorporationHistory();
  const logoutMutation = useAuthLogout(() => {
    router.replace("/login");
  });

  const hasSessionAuthError =
    currentUserQuery.isAuthError ||
    isAuthenticationError(corporationQuery.error) ||
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

  if (props.mode === "edit") {
    if (corporationQuery.isLoading) {
      return (
        <div {...stylex.props(s.loadingBox)}>
          <Spinner size="lg" label="企業情報を読み込み中…" showLabel />
        </div>
      );
    }

    if (corporationQuery.errorMessage || !corporationQuery.data) {
      return (
        <div data-vendor-console="" {...stylex.props(layout.page)}>
          <div {...stylex.props(layout.container)}>
            <VendorConsoleHeader
              title="導入企業（法人・個人開設者）の編集・管理"
              activeSection="corporations"
              currentUser={currentUserQuery.data}
              isLoggingOut={logoutMutation.isPending}
              onLogout={() => logoutMutation.mutate()}
            />
            <section {...stylex.props(layout.panel)}>
              <Alert tone="error" title="企業情報を取得できませんでした" role="alert">
                <p>{corporationQuery.errorMessage ?? "指定された企業が見つかりませんでした。"}</p>
              </Alert>
              <div>
                <Link href="/vendor/corporations" {...stylex.props(s.outlinedLinkButton)}>
                  法人一覧へ戻る
                </Link>
              </div>
            </section>
          </div>
        </div>
      );
    }

    const updateUserFacingError =
      updateMutation.error instanceof ApiError ? updateMutation.error.userFacing : null;

    return (
      <CorporationFormPage
        key={corporationQuery.data.id}
        mode="edit"
        currentUser={currentUserQuery.data}
        initialCorporation={corporationQuery.data}
        isSubmitting={updateMutation.isPending}
        submitErrorMessage={updateMutation.errorMessage}
        submitUserFacingError={updateUserFacingError}
        onUpdateCorporation={async (corporationId, payload) => {
          try {
            await updateMutation.mutateAsync({ corporationId, payload });
            router.push("/vendor/corporations?notice=updated");
            return true;
          } catch {
            return false;
          }
        }}
        isChangingUsageStatus={changeUsageStatusMutation.isPending}
        usageStatusErrorMessage={changeUsageStatusMutation.errorMessage}
        onChangeUsageStatus={async (corporationId, usageStatus) => {
          try {
            await changeUsageStatusMutation.mutateAsync({ corporationId, usageStatus });
            return true;
          } catch {
            return false;
          }
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
            await changeStatusMutation.mutateAsync({ corporationId, payload });
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
        isLoggingOut={logoutMutation.isPending}
        onLogout={() => logoutMutation.mutate()}
      />
    );
  }

  const createUserFacingError =
    createMutation.error instanceof ApiError ? createMutation.error.userFacing : null;

  return (
    <CorporationFormPage
      mode="create"
      currentUser={currentUserQuery.data}
      isSubmitting={createMutation.isPending}
      submitErrorMessage={createMutation.errorMessage}
      submitUserFacingError={createUserFacingError}
      onCreateCorporation={async (input) => {
        try {
          await createMutation.mutateAsync(input);
          router.push("/vendor/corporations?notice=created");
          return true;
        } catch {
          return false;
        }
      }}
      isLoggingOut={logoutMutation.isPending}
      onLogout={() => logoutMutation.mutate()}
    />
  );
}
