"use client";

import * as stylex from "@stylexjs/stylex";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { isAuthenticationError } from "@/features/auth/api";
import { useAuthLogout, useClearAuthCache, useCurrentAuthUser } from "@/features/auth/useAuth";
import { useCorporations } from "@/features/corporations/useCorporations";
import { Spinner } from "@/shared/ui/spinner/Spinner";
import { CorporateRelationCreatePage } from "./CorporateRelationCreatePage";
import { corporateRelationsWorkspaceStyles as s } from "./CorporateRelationsWorkspace.styles";
import { useRegisterCorporateRelation } from "./useCorporateRelations";

/** 新規法人間関係登録画面のコンテナ。 */
export function CorporateRelationCreateContainer() {
  const router = useRouter();
  const clearAuthCache = useClearAuthCache();
  const currentUserQuery = useCurrentAuthUser();

  const isVendorUser = currentUserQuery.data?.affiliation_type === "vendor";
  const corporationsQuery = useCorporations({}, Boolean(isVendorUser));
  const registerMutation = useRegisterCorporateRelation();
  const logoutMutation = useAuthLogout(() => {
    router.replace("/login");
  });

  const hasSessionAuthError =
    currentUserQuery.isAuthError ||
    isAuthenticationError(corporationsQuery.error) ||
    isAuthenticationError(registerMutation.error);

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
    <CorporateRelationCreatePage
      currentUser={currentUserQuery.data}
      corporations={corporationsQuery.data?.items ?? []}
      isRegistering={registerMutation.isPending}
      registerErrorMessage={registerMutation.errorMessage}
      onRegisterRelation={async (input) => {
        try {
          await registerMutation.mutateAsync(input);
          router.push("/vendor/corporations/relations?notice=created");
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
