"use client";

import * as stylex from "@stylexjs/stylex";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { isAuthenticationError } from "@/features/auth/api";
import { useAuthLogout, useClearAuthCache, useCurrentAuthUser } from "@/features/auth/useAuth";
import { useCorporations } from "@/features/corporations/useCorporations";
import { Spinner } from "@/shared/ui/spinner/Spinner";
import { CorporateRelationsWorkspace } from "./CorporateRelationsWorkspace";
import { corporateRelationsWorkspaceStyles as s } from "./CorporateRelationsWorkspace.styles";
import type { CorporateRelationListFilter } from "./schemas";
import {
  useCorporateRelationHistory,
  useCorporateRelations,
  useCorrectCorporateRelation,
  useEndCorporateRelation,
} from "./useCorporateRelations";

/** 法人間関係管理画面のコンテナ。 */
export function CorporateRelationsContainer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clearAuthCache = useClearAuthCache();
  const currentUserQuery = useCurrentAuthUser();
  const [filter, setFilter] = useState<CorporateRelationListFilter>({});
  const [selectedHistoryRelationId, setSelectedHistoryRelationId] = useState<string | null>(null);

  const isVendorUser = currentUserQuery.data?.affiliation_type === "vendor";
  const corporationsQuery = useCorporations({}, Boolean(isVendorUser));
  const relationsQuery = useCorporateRelations(filter, Boolean(isVendorUser));
  const historyQuery = useCorporateRelationHistory(
    selectedHistoryRelationId ?? "",
    Boolean(isVendorUser && selectedHistoryRelationId),
  );
  const correctMutation = useCorrectCorporateRelation();
  const endMutation = useEndCorporateRelation();
  const logoutMutation = useAuthLogout(() => {
    router.replace("/login");
  });

  const notice = searchParams.get("notice") === "created" ? "created" : null;

  const hasSessionAuthError =
    currentUserQuery.isAuthError ||
    isAuthenticationError(corporationsQuery.error) ||
    isAuthenticationError(relationsQuery.error) ||
    isAuthenticationError(historyQuery.error) ||
    isAuthenticationError(correctMutation.error) ||
    isAuthenticationError(endMutation.error);

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

  return (
    <CorporateRelationsWorkspace
      currentUser={currentUserQuery.data}
      corporations={corporationsQuery.data?.items ?? []}
      relations={relationsQuery.data?.items ?? []}
      totalCount={relationsQuery.data?.total ?? 0}
      filter={filter}
      onFilterChange={setFilter}
      isLoadingRelations={relationsQuery.isLoading}
      relationsErrorMessage={relationsQuery.errorMessage}
      notice={notice}
      onDismissNotice={() => router.replace("/vendor/corporations/relations", { scroll: false })}
      isCorrecting={correctMutation.isPending}
      correctErrorMessage={correctMutation.errorMessage}
      onCorrectRelation={async (relationId, payload) => {
        try {
          await correctMutation.mutateAsync({ relationId, payload });
          return true;
        } catch {
          return false;
        }
      }}
      isEnding={endMutation.isPending}
      endErrorMessage={endMutation.errorMessage}
      onEndRelation={async (relationId, validTo) => {
        try {
          await endMutation.mutateAsync({ relationId, validTo });
          return true;
        } catch {
          return false;
        }
      }}
      selectedHistoryRelationId={selectedHistoryRelationId}
      onSelectHistoryRelation={setSelectedHistoryRelationId}
      revisions={historyQuery.data ?? []}
      isLoadingRevisions={historyQuery.isLoading}
      revisionsErrorMessage={historyQuery.errorMessage}
      isLoggingOut={logoutMutation.isPending}
      onLogout={() => logoutMutation.mutate()}
    />
  );
}
