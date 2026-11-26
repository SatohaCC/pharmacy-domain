"use client";

import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import type { ApiUserFacingError } from "@/shared/lib/api/apiClient";
import { Alert } from "@/shared/ui/alert/Alert";
import { Badge } from "@/shared/ui/badge/Badge";
import { Button } from "@/shared/ui/button/Button";
import { Select, type SelectOption } from "@/shared/ui/select/Select";
import { Spinner } from "@/shared/ui/spinner/Spinner";
import { TextField } from "@/shared/ui/text-field/TextField";
import { evaluatePasswordPolicy, generateSecurePassword } from "./passwordGenerator";
import type { AuthRole, AuthUser, VendorAssignableRole } from "./schemas";
import { vendorUsersWorkspaceStyles as s } from "./VendorUsersWorkspace.styles";

const ROLE_OPTIONS: readonly SelectOption[] = [
  { value: "vendor_member", label: "一般社員（vendor_member）" },
  { value: "vendor_admin", label: "ベンダー管理者（vendor_admin）" },
];

function roleLabel(role: AuthRole): string {
  switch (role) {
    case "vendor_admin":
      return "管理者";
    case "vendor_member":
      return "一般社員";
    case "tenant_admin":
      return "薬局管理者";
    case "pharmacist":
      return "薬剤師";
    case "clerk":
      return "事務";
  }
}

export interface VendorUsersWorkspaceProps {
  currentUser: AuthUser;
  users: readonly AuthUser[];
  isLoadingUsers: boolean;
  usersErrorMessage: string | null;
  isCreatingUser: boolean;
  createErrorMessage: string | null;
  createUserFacingError: ApiUserFacingError | null;
  lastIssuedUser: { user: AuthUser; initialPassword: string } | null;
  isLoggingOut: boolean;
  onCreateUser: (input: {
    email: string;
    display_name: string;
    roles: VendorAssignableRole[];
    password: string;
  }) => Promise<boolean>;
  onDismissIssuedBanner: () => void;
  onLogout: () => void;
}

/** Material Design 3 準拠のベンダー社員アカウント管理ワークスペース。 */
export function VendorUsersWorkspace({
  currentUser,
  users,
  isLoadingUsers,
  usersErrorMessage,
  isCreatingUser,
  createErrorMessage,
  createUserFacingError,
  lastIssuedUser,
  isLoggingOut,
  onCreateUser,
  onDismissIssuedBanner,
  onLogout,
}: VendorUsersWorkspaceProps) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<VendorAssignableRole>("vendor_member");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  const [displayNameError, setDisplayNameError] = useState<string | undefined>(undefined);
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);

  const policy = evaluatePasswordPolicy(password);
  const isAdmin = currentUser.roles.includes("vendor_admin");

  function handleGeneratePassword() {
    const generated = generateSecurePassword(16);
    setPassword(generated);
    setShowPassword(true);
    setPasswordError(undefined);
    setCopiedPassword(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = displayName.trim();
    const trimmedEmail = email.trim();

    const nextNameError = trimmedName ? undefined : "表示名を入力してください。";
    const nextEmailError = trimmedEmail ? undefined : "メールアドレスを入力してください。";
    const nextPasswordError = policy.isValid
      ? undefined
      : "13文字以上128文字以下、英大文字・英小文字・数字・記号のうち3種類以上を含めてください。";

    setDisplayNameError(nextNameError);
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);

    if (nextNameError || nextEmailError || nextPasswordError) {
      return;
    }

    const created = await onCreateUser({
      display_name: trimmedName,
      email: trimmedEmail,
      roles: [role],
      password,
    });
    if (created) {
      setDisplayName("");
      setEmail("");
      setRole("vendor_member");
      setPassword("");
      setShowPassword(false);
    }
  }

  async function handleCopyIssuedPassword(secret: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(secret);
      setCopiedPassword(true);
    }
  }

  return (
    <div {...stylex.props(s.page)}>
      <div {...stylex.props(s.container)}>
        <header {...stylex.props(s.topBar)}>
          <div {...stylex.props(s.identity)}>
            <p {...stylex.props(s.eyebrow)}>SYSTEM VENDOR CONSOLE</p>
            <div {...stylex.props(s.titleRow)}>
              <h1 {...stylex.props(s.heading)}>ベンダーアカウント管理</h1>
              {currentUser.roles.map((r) => (
                <Badge key={r} tone={r === "vendor_admin" ? "success" : "neutral"}>
                  {roleLabel(r)}
                </Badge>
              ))}
            </div>
            <p {...stylex.props(s.subText)}>
              ログイン中: {currentUser.display_name}（{currentUser.email}）
            </p>
          </div>
          <div {...stylex.props(s.topActions)}>
            <Button variant="outlined" onClick={onLogout} disabled={isLoggingOut}>
              {isLoggingOut ? "ログアウト中…" : "ログアウト"}
            </Button>
          </div>
        </header>

        {!isAdmin ? (
          <Alert tone="info" title="一般社員アカウントでログインしています">
            ベンダー社員アカウントの発行および全アカウント一覧の閲覧は、システムベンダー管理者（vendor_admin）のみ操作できます。
          </Alert>
        ) : (
          <>
            <section aria-labelledby="create-vendor-user-heading" {...stylex.props(s.card)}>
              <div>
                <h2 id="create-vendor-user-heading" {...stylex.props(s.sectionTitle)}>
                  ベンダー社員アカウントの発行
                </h2>
                <p {...stylex.props(s.sectionDescription)}>
                  新しいシステムベンダー社員アカウントを発行します。初期パスワードは安全管理ガイドライン第7.0版（13文字以上・3種類以上混在）に準拠する必要があります。
                </p>
              </div>

              {lastIssuedUser ? (
                <Alert
                  tone="success"
                  title="ベンダー社員アカウントを発行しました"
                  onDismiss={onDismissIssuedBanner}
                  dismissLabel="発行完了メッセージを閉じる"
                >
                  <p>
                    {lastIssuedUser.user.display_name}（{lastIssuedUser.user.email} /{" "}
                    {lastIssuedUser.user.roles.map(roleLabel).join("・")}）を登録しました。
                  </p>
                  <div {...stylex.props(s.issuedSecretBox)}>
                    <code {...stylex.props(s.issuedCode)}>{lastIssuedUser.initialPassword}</code>
                    <Button
                      variant="tonal"
                      size="sm"
                      onClick={() => void handleCopyIssuedPassword(lastIssuedUser.initialPassword)}
                    >
                      {copiedPassword ? "コピー済み" : "初期パスワードをコピー"}
                    </Button>
                  </div>
                </Alert>
              ) : null}

              {createErrorMessage ? (
                <Alert
                  tone="error"
                  title={createUserFacingError?.title ?? "アカウントを発行できませんでした"}
                  role="alert"
                >
                  <p>{createUserFacingError?.reason ?? createErrorMessage}</p>
                  {createUserFacingError?.how_to_fix ? (
                    <p>{createUserFacingError.how_to_fix}</p>
                  ) : null}
                </Alert>
              ) : null}

              <form onSubmit={handleSubmit} noValidate {...stylex.props(s.passwordRow)}>
                <div {...stylex.props(s.formGrid)}>
                  <TextField
                    label="氏名（表示名）"
                    name="display_name"
                    placeholder="運用 太郎"
                    value={displayName}
                    onValueChange={(value) => {
                      setDisplayName(value);
                      if (displayNameError) setDisplayNameError(undefined);
                    }}
                    errorMessage={displayNameError}
                    required
                    disabled={isCreatingUser}
                  />
                  <TextField
                    label="メールアドレス"
                    name="email"
                    type="email"
                    placeholder="staff@vendor.example.com"
                    value={email}
                    onValueChange={(value) => {
                      setEmail(value);
                      if (emailError) setEmailError(undefined);
                    }}
                    errorMessage={emailError}
                    required
                    disabled={isCreatingUser}
                  />
                  <Select
                    label="ロール"
                    name="role"
                    items={ROLE_OPTIONS}
                    value={role}
                    onValueChange={(value) => {
                      if (value === "vendor_admin" || value === "vendor_member") {
                        setRole(value);
                      }
                    }}
                    required
                    disabled={isCreatingUser}
                  />
                </div>

                <div {...stylex.props(s.passwordRow)}>
                  <TextField
                    label="初期パスワード"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    description="13文字以上128文字以下・英大文字/英小文字/数字/記号のうち3種類以上"
                    value={password}
                    onValueChange={(value) => {
                      setPassword(value);
                      if (passwordError) setPasswordError(undefined);
                      setCopiedPassword(false);
                    }}
                    errorMessage={passwordError}
                    required
                    disabled={isCreatingUser}
                    trailing={
                      <Button
                        variant="text"
                        size="sm"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? "初期パスワードを隠す" : "初期パスワードを表示"}
                        disabled={isCreatingUser}
                      >
                        {showPassword ? "隠す" : "表示"}
                      </Button>
                    }
                  />

                  <div {...stylex.props(s.passwordActions)}>
                    <Button
                      variant="tonal"
                      size="sm"
                      onClick={handleGeneratePassword}
                      disabled={isCreatingUser}
                    >
                      安全なパスワードを自動生成
                    </Button>
                  </div>

                  <ul {...stylex.props(s.policyList)}>
                    <li
                      {...stylex.props(policy.hasMinLength && policy.hasMaxLength && s.policyMet)}
                    >
                      13文字以上128文字以下（現在 {password.length} 文字）
                    </li>
                    <li {...stylex.props(policy.classCount >= 3 && s.policyMet)}>
                      英大文字・英小文字・数字・記号のうち3種類以上（現在 {policy.classCount} 種類）
                    </li>
                    <li {...stylex.props(policy.hasNoControlOrEdgeSpaces && s.policyMet)}>
                      前後の空白および制御文字を含まない
                    </li>
                  </ul>
                </div>

                <div {...stylex.props(s.submitRow)}>
                  <Button type="submit" variant="filled" disabled={isCreatingUser}>
                    {isCreatingUser ? "発行中…" : "ベンダー社員アカウントを発行"}
                  </Button>
                </div>
              </form>
            </section>

            <section aria-labelledby="vendor-user-list-heading" {...stylex.props(s.card)}>
              <div>
                <h2 id="vendor-user-list-heading" {...stylex.props(s.sectionTitle)}>
                  登録済みベンダーアカウント一覧
                </h2>
              </div>

              {isLoadingUsers ? (
                <Spinner label="アカウント一覧を読み込み中…" showLabel />
              ) : usersErrorMessage ? (
                <Alert tone="error" title="一覧を取得できませんでした" role="alert">
                  {usersErrorMessage}
                </Alert>
              ) : (
                <ul {...stylex.props(s.userList)}>
                  {users.map((item) => (
                    <li key={item.id} {...stylex.props(s.userItem)}>
                      <div {...stylex.props(s.userInfo)}>
                        <p {...stylex.props(s.userName)}>{item.display_name}</p>
                        <p {...stylex.props(s.userEmail)}>{item.email}</p>
                      </div>
                      <div {...stylex.props(s.userBadges)}>
                        {item.roles.map((r) => (
                          <Badge key={r} tone={r === "vendor_admin" ? "success" : "neutral"}>
                            {roleLabel(r)}
                          </Badge>
                        ))}
                        <Badge tone={item.status === "active" ? "success" : "danger"}>
                          {item.status === "active" ? "有効" : "無効"}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
