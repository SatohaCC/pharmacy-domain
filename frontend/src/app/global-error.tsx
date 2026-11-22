"use client";

import * as stylex from "@stylexjs/stylex";
import { Button } from "@/shared/ui/button/Button";
import "./globals.css";
import { layoutStyles } from "./layout.styles";
import { statusPageStyles as s } from "./status-page.styles";

function getErrorDigest(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof error.digest === "string" &&
    error.digest.trim()
  ) {
    return error.digest;
  }
  return null;
}

export interface GlobalErrorProps {
  error: unknown;
  retry: () => void;
}

/** ルートレイアウト障害時に表示するフォールバック UI 本体。 */
export function GlobalErrorContent({ error, retry }: GlobalErrorProps) {
  const digest = getErrorDigest(error);

  return (
    <main id="main-content" tabIndex={-1} {...stylex.props(s.page)}>
      <section aria-labelledby="global-error-title" role="alert" {...stylex.props(s.card)}>
        <p lang="en" translate="no" {...stylex.props(s.code, s.errorCode)}>
          FATAL ERROR
        </p>
        <h1 id="global-error-title" {...stylex.props(s.title)}>
          アプリケーションの読み込みに失敗しました
        </h1>
        <p {...stylex.props(s.description)}>
          ルートレイアウトで予期しないエラーが発生しました。再試行するか、トップページを再読み込みしてください。
        </p>
        {digest ? <p {...stylex.props(s.digest)}>識別子: {digest}</p> : null}
        <div {...stylex.props(s.actions)}>
          <Button variant="filled" onClick={retry}>
            再試行
          </Button>
          {/* ルートレイアウト障害時はルーター状態に依存せずフルリロードで復帰させる */}
          <a href="/" {...stylex.props(s.homeLink)}>
            トップページへ戻る
          </a>
        </div>
      </section>
    </main>
  );
}

/** ルートレイアウト全体の未処理例外を受け止める Next.js グローバルエラー画面。 */
export default function GlobalError({ error, retry }: GlobalErrorProps) {
  return (
    <html lang="ja">
      <head>
        <meta name="color-scheme" content="light dark" />
        <meta name="text-scale" content="scale" />
        <title>エラー | Next.js + FastAPI</title>
      </head>
      <body {...stylex.props(layoutStyles.body)}>
        <GlobalErrorContent error={error} retry={retry} />
      </body>
    </html>
  );
}
