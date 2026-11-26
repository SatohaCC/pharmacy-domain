"use client";

import { useCallback } from "react";
import { useAppMutation } from "@/shared/lib/query/useAppMutation";
import { useAppQuery } from "@/shared/lib/query/useAppQuery";
import { useRemoveQueries } from "@/shared/lib/query/useRemoveQueries";
import {
  createVendorUser,
  fetchCurrentVendorUser,
  fetchVendorUsers,
  isAuthenticationError,
  loginVendorUser,
  logoutVendorUser,
} from "./api";
import type { VendorRole } from "./schemas";

export const vendorAuthKeys = {
  all: ["vendor-auth"] as const,
  me: ["vendor-auth", "me"] as const,
  users: ["vendor-auth", "users"] as const,
};

/** 現在ログイン中のベンダーユーザー情報を取得する（認証失効時はキャッシュを隠蔽する）。 */
export function useCurrentVendorUser() {
  const query = useAppQuery({
    queryKey: vendorAuthKeys.me,
    queryFn: ({ signal }) => fetchCurrentVendorUser(signal),
    retry: false,
  });
  const isAuthError = isAuthenticationError(query.error);

  return {
    ...query,
    data: isAuthError ? null : query.data,
    isAuthError,
  };
}

/** 認証キャッシュ（vendor-auth）をすべて削除するコールバックを返す。 */
export function useClearVendorAuthCache() {
  const removeQueries = useRemoveQueries();
  return useCallback(() => {
    removeQueries(vendorAuthKeys.all);
  }, [removeQueries]);
}

/** ベンダーログインを実行する。 */
export function useVendorLogin(onSuccess?: () => void) {
  return useAppMutation({
    mutationFn: (input: { email: string; password: string }) => loginVendorUser(input),
    removeKeys: [vendorAuthKeys.all],
    onSuccess: () => onSuccess?.(),
  });
}

/** ベンダーログアウトを実行する。 */
export function useVendorLogout(onSuccess?: () => void) {
  return useAppMutation({
    mutationFn: () => logoutVendorUser(),
    removeKeys: [vendorAuthKeys.all],
    onSuccess: () => onSuccess?.(),
  });
}

/** ベンダーユーザー一覧を取得する（管理者のみ）。 */
export function useVendorUsers(enabled: boolean) {
  return useAppQuery({
    queryKey: vendorAuthKeys.users,
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
      role: VendorRole;
      password: string;
    }) => createVendorUser(input),
    invalidateKeys: [vendorAuthKeys.users],
  });
}
