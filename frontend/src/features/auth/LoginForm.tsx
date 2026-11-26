"use client";

import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import type { ApiUserFacingError } from "@/shared/lib/api/apiClient";
import { Alert } from "@/shared/ui/alert/Alert";
import { Button } from "@/shared/ui/button/Button";
import { TextField } from "@/shared/ui/text-field/TextField";
import { loginFormStyles as s } from "./LoginForm.styles";

export interface LoginFormProps {
  isSubmitting: boolean;
  errorMessage: string | null;
  userFacingError: ApiUserFacingError | null;
  onSubmit: (values: { email: string; password: string }) => void;
  onNavigateHome?: () => void;
}

/** Material Design 3 準拠のシステムベンダーログインフォーム。 */
export function LoginForm({
  isSubmitting,
  errorMessage,
  userFacingError,
  onSubmit,
  onNavigateHome,
}: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    const nextEmailError = trimmedEmail ? undefined : "メールアドレスを入力してください。";
    const nextPasswordError = password ? undefined : "パスワードを入力してください。";
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);

    if (nextEmailError || nextPasswordError) {
      return;
    }

    onSubmit({ email: trimmedEmail, password });
  }

  return (
    <div {...stylex.props(s.shell)}>
      <section aria-labelledby="vendor-login-heading" {...stylex.props(s.card)}>
        <header {...stylex.props(s.header)}>
          <h1 id="vendor-login-heading" {...stylex.props(s.title)}>
            システムベンダーログイン
          </h1>
          <p {...stylex.props(s.subtitle)}>
            コンソールまたは管理者から発行されたシステムベンダーアカウントでログインしてください。
          </p>
        </header>

        <div {...stylex.props(s.content)}>
          {errorMessage ? (
            <Alert
              tone="error"
              title={userFacingError?.title ?? "ログインできませんでした"}
              role="alert"
            >
              <p {...stylex.props(s.errorDetails)}>{userFacingError?.reason ?? errorMessage}</p>
              {userFacingError?.how_to_fix ? (
                <p {...stylex.props(s.errorHint)}>{userFacingError.how_to_fix}</p>
              ) : null}
            </Alert>
          ) : null}

          <form onSubmit={handleSubmit} noValidate {...stylex.props(s.form)}>
            <TextField
              label="メールアドレス"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="admin@vendor.example.com"
              value={email}
              onValueChange={(value) => {
                setEmail(value);
                if (emailError) setEmailError(undefined);
              }}
              errorMessage={emailError}
              required
              disabled={isSubmitting}
            />

            <TextField
              label="パスワード"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onValueChange={(value) => {
                setPassword(value);
                if (passwordError) setPasswordError(undefined);
              }}
              errorMessage={passwordError}
              required
              disabled={isSubmitting}
              trailing={
                <Button
                  variant="text"
                  size="sm"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"}
                  disabled={isSubmitting}
                >
                  {showPassword ? "隠す" : "表示"}
                </Button>
              }
            />

            <div {...stylex.props(s.actions)}>
              <Button type="submit" variant="filled" disabled={isSubmitting} style={s.submitButton}>
                {isSubmitting ? "ログイン中…" : "ログイン"}
              </Button>
            </div>
          </form>

          <p {...stylex.props(s.footerNote)}>
            最初の管理アカウントはサーバーコンソールから発行してください。{" "}
            {onNavigateHome ? (
              <Button variant="text" size="sm" onClick={onNavigateHome}>
                トップページへ戻る
              </Button>
            ) : (
              <a href="/" {...stylex.props(s.backLink)}>
                トップページへ戻る
              </a>
            )}
          </p>
        </div>
      </section>
    </div>
  );
}
