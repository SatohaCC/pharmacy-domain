"use client";

import { useAppMutation } from "@/shared/lib/query/useAppMutation";
import { useAppQuery } from "@/shared/lib/query/useAppQuery";
import {
  createVendorUser,
  fetchCurrentVendorUser,
  fetchVendorUsers,
  loginVendorUser,
  logoutVendorUser,
} from "./api";
import type { VendorRole } from "./schemas";

export const vendorAuthKeys = {
  all: ["vendor-auth"] as const,
  me: ["vendor-auth", "me"] as const,
  users: ["vendor-auth", "users"] as const,
};

/** 現在ログイン中のベンダーユーザー情報を取得する。 */
export function useCurrentVendorUser() {
  return useAppQuery({
    queryKey: vendorAuthKeys.me,
    queryFn: ({ signal }) => fetchCurrentVendorUser(signal),
    retry: false,
  });
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
