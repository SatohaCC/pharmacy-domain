"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ApiError } from "@/shared/lib/api/apiClient";
import { LoginForm } from "./LoginForm";
import { useAuthLogin, useCurrentAuthUser } from "./useAuth";

/** ログイン画面のコンテナ。認証済みなら法人管理画面へ遷移する。 */
export function LoginContainer() {
  const router = useRouter();
  const currentUserQuery = useCurrentAuthUser();
  const loginMutation = useAuthLogin(() => {
    router.replace("/vendor/corporations");
  });

  useEffect(() => {
    if (
      !currentUserQuery.isLoading &&
      !currentUserQuery.isFetching &&
      !currentUserQuery.isAuthError &&
      !currentUserQuery.error &&
      currentUserQuery.data
    ) {
      router.replace("/vendor/corporations");
    }
  }, [
    currentUserQuery.data,
    currentUserQuery.error,
    currentUserQuery.isAuthError,
    currentUserQuery.isFetching,
    currentUserQuery.isLoading,
    router,
  ]);

  const userFacingError =
    loginMutation.error instanceof ApiError ? loginMutation.error.userFacing : null;

  return (
    <LoginForm
      isSubmitting={loginMutation.isPending}
      errorMessage={loginMutation.errorMessage}
      userFacingError={userFacingError}
      onSubmit={(values) => {
        loginMutation.mutate({ ...values, scope_type: "vendor" });
      }}
      onNavigateHome={() => router.push("/")}
    />
  );
}
