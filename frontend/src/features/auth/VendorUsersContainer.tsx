"use client";

import * as stylex from "@stylexjs/stylex";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError } from "@/shared/lib/api/apiClient";
import { Spinner } from "@/shared/ui/spinner/Spinner";
import { isAuthenticationError } from "./api";
import type { AuthUser } from "./schemas";
import {
  useAuthLogout,
  useClearAuthCache,
  useCreateVendorUser,
  useCurrentAuthUser,
  useVendorUsers,
} from "./useAuth";
import { VendorUsersWorkspace } from "./VendorUsersWorkspace";
import { vendorUsersWorkspaceStyles as s } from "./VendorUsersWorkspace.styles";

/** ベンダーアカウント管理画面のコンテナ。未認証・認証失効時はキャッシュを削除して /login へ遷移する。 */
export function VendorUsersContainer() {
  const router = useRouter();
  const clearAuthCache = useClearAuthCache();
  const currentUserQuery = useCurrentAuthUser();
  const isAdmin = Boolean(currentUserQuery.data?.roles.includes("vendor_admin"));
  const usersQuery = useVendorUsers(isAdmin);
  const createUserMutation = useCreateVendorUser();
  const logoutMutation = useAuthLogout(() => {
    router.replace("/login");
  });

  const [lastIssuedUser, setLastIssuedUser] = useState<{
    user: AuthUser;
    initialPassword: string;
  } | null>(null);

  const hasSessionAuthError =
    currentUserQuery.isAuthError ||
    isAuthenticationError(usersQuery.error) ||
    isAuthenticationError(createUserMutation.error);

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
    createUserMutation.error instanceof ApiError ? createUserMutation.error.userFacing : null;

  return (
    <VendorUsersWorkspace
      currentUser={currentUserQuery.data}
      users={usersQuery.data?.items ?? []}
      isLoadingUsers={usersQuery.isLoading}
      usersErrorMessage={usersQuery.errorMessage}
      isCreatingUser={createUserMutation.isPending}
      createErrorMessage={createUserMutation.errorMessage}
      createUserFacingError={createUserFacingError}
      lastIssuedUser={lastIssuedUser}
      isLoggingOut={logoutMutation.isPending}
      onCreateUser={async (input) => {
        try {
          const created = await createUserMutation.mutateAsync(input);
          setLastIssuedUser({ user: created, initialPassword: input.password });
          return true;
        } catch {
          return false;
        }
      }}
      onDismissIssuedBanner={() => setLastIssuedUser(null)}
      onLogout={() => {
        logoutMutation.mutate();
      }}
    />
  );
}
