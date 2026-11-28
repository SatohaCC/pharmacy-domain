"use client";

import * as stylex from "@stylexjs/stylex";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { isAuthenticationError } from "@/features/auth/api";
import { useAuthLogout, useClearAuthCache, useCurrentAuthUser } from "@/features/auth/useAuth";
import { Spinner } from "@/shared/ui/spinner/Spinner";
import { CorporationsWorkspace } from "./CorporationsWorkspace";
import { corporationsWorkspaceStyles as s } from "./CorporationsWorkspace.styles";
import type { CorporationListFilter } from "./schemas";
import { useCorporations } from "./useCorporations";

/** 導入企業（法人・個人開設者）一覧画面のコンテナ。未認証・認証失効時はキャッシュを削除して /login へ遷移する。 */
export function CorporationsContainer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clearAuthCache = useClearAuthCache();
  const currentUserQuery = useCurrentAuthUser();
  const [filter, setFilter] = useState<CorporationListFilter>({});

  const isVendorUser = currentUserQuery.data?.affiliation_type === "vendor";
  const corporationsQuery = useCorporations(filter, Boolean(isVendorUser));
  const logoutMutation = useAuthLogout(() => {
    router.replace("/login");
  });

  const noticeParam = searchParams.get("notice");
  const notice = noticeParam === "created" || noticeParam === "updated" ? noticeParam : null;

  const hasSessionAuthError =
    currentUserQuery.isAuthError || isAuthenticationError(corporationsQuery.error);

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
    <CorporationsWorkspace
      currentUser={currentUserQuery.data}
      corporations={corporationsQuery.data?.items ?? []}
      totalCount={corporationsQuery.data?.total ?? 0}
      filter={filter}
      onFilterChange={setFilter}
      isLoadingCorporations={corporationsQuery.isLoading}
      isFetchingCorporations={corporationsQuery.isFetching}
      corporationsErrorMessage={corporationsQuery.errorMessage}
      notice={notice}
      onDismissNotice={() => router.replace("/vendor/corporations", { scroll: false })}
      isLoggingOut={logoutMutation.isPending}
      onLogout={() => {
        logoutMutation.mutate();
      }}
    />
  );
}
