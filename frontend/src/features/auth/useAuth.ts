"use client";

import { useCallback } from "react";
import { useAppMutation } from "@/shared/lib/query/useAppMutation";
import { useAppQuery } from "@/shared/lib/query/useAppQuery";
import { useRemoveQueries } from "@/shared/lib/query/useRemoveQueries";
import {
  createVendorUser,
  fetchCurrentAuthUser,
  fetchVendorUsers,
  isAuthenticationError,
  loginAuthUser,
  logoutAuthUser,
} from "./api";
import type { AffiliationType, VendorAssignableRole } from "./schemas";

export const authKeys = {
  all: ["auth"] as const,
  me: ["auth", "me"] as const,
  vendorUsers: ["auth", "vendor-users"] as const,
};

/** 現在ログイン中のユーザー情報を取得する（認証失効時はキャッシュを隠蔽する）。 */
export function useCurrentAuthUser() {
  const query = useAppQuery({
    queryKey: authKeys.me,
    queryFn: ({ signal }) => fetchCurrentAuthUser(signal),
    retry: false,
  });
  const isAuthError = isAuthenticationError(query.error);

  return {
    ...query,
    data: isAuthError ? null : query.data,
    isAuthError,
  };
}

/** 認証キャッシュ（auth）をすべて削除するコールバックを返す。 */
export function useClearAuthCache() {
  const removeQueries = useRemoveQueries();
  return useCallback(() => {
    removeQueries(authKeys.all);
  }, [removeQueries]);
}

/** 共通ログインを実行する。 */
export function useAuthLogin(onSuccess?: () => void) {
  return useAppMutation({
    mutationFn: (input: {
      email: string;
      password: string;
      scope_type?: AffiliationType;
      tenant_id?: string | null;
    }) => loginAuthUser(input),
    removeKeys: [authKeys.all],
    onSuccess: () => onSuccess?.(),
  });
}

/** 共通ログアウトを実行する。 */
export function useAuthLogout(onSuccess?: () => void) {
  return useAppMutation({
    mutationFn: () => logoutAuthUser(),
    removeKeys: [authKeys.all],
    onSuccess: () => onSuccess?.(),
  });
}

/** ベンダーユーザー一覧を取得する（vendor_admin のみ）。 */
export function useVendorUsers(enabled: boolean) {
  return useAppQuery({
    queryKey: authKeys.vendorUsers,
    queryFn: ({ signal }) => fetchVendorUsers(signal),
    enabled,
    retry: false,
  });
}

/** 管理者権限で新しいベンダー社員アカウントを発行する。 */
export function useCreateVendorUser() {
  return useAppMutation({
    mutationFn: (input: {
      email: string;
      display_name: string;
      roles: VendorAssignableRole[];
      password: string;
    }) => createVendorUser(input),
    invalidateKeys: [authKeys.vendorUsers],
  });
}
