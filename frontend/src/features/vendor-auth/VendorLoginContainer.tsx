"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ApiError } from "@/shared/lib/api/apiClient";
import { useCurrentVendorUser, useVendorLogin } from "./useVendorAuth";
import { VendorLoginForm } from "./VendorLoginForm";

/** ベンダーログイン画面のコンテナ。認証済みなら管理画面へ遷移する。 */
export function VendorLoginContainer() {
  const router = useRouter();
  const currentUserQuery = useCurrentVendorUser();
  const loginMutation = useVendorLogin(() => {
    router.replace("/vendor/users");
  });

  useEffect(() => {
    if (currentUserQuery.data) {
      router.replace("/vendor/users");
    }
  }, [currentUserQuery.data, router]);

  const userFacingError =
    loginMutation.error instanceof ApiError ? loginMutation.error.userFacing : null;

  return (
    <VendorLoginForm
      isSubmitting={loginMutation.isPending}
      errorMessage={loginMutation.errorMessage}
      userFacingError={userFacingError}
      onSubmit={(values) => {
        loginMutation.mutate(values);
      }}
      onNavigateHome={() => router.push("/")}
    />
  );
}
