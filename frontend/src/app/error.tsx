"use client";

import * as stylex from "@stylexjs/stylex";
import Link from "next/link";
import { Button } from "@/shared/ui/button/Button";
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

export interface AppErrorPageProps {
  error: unknown;
  retry: () => void;
}

/** ルートセグメントで未処理の実行時エラーが発生した際のフォールバック画面。 */
export default function AppErrorPage({ error, retry }: AppErrorPageProps) {
  const digest = getErrorDigest(error);

  return (
    <main id="main-content" tabIndex={-1} {...stylex.props(s.page)}>
      <section aria-labelledby="error-title" role="alert" {...stylex.props(s.card)}>
        <p lang="en" translate="no" {...stylex.props(s.code, s.errorCode)}>
          ERROR
        </p>
        <h1 id="error-title" {...stylex.props(s.title)}>
          予期しないエラーが発生しました
        </h1>
        <p {...stylex.props(s.description)}>
          一時的な問題の可能性があります。再試行するか、トップページへ戻ってください。
        </p>
        {digest ? <p {...stylex.props(s.digest)}>識別子: {digest}</p> : null}
        <div {...stylex.props(s.actions)}>
          <Button variant="filled" onClick={retry}>
            再試行
          </Button>
          <Link href="/" {...stylex.props(s.homeLink)}>
            トップページへ戻る
          </Link>
        </div>
      </section>
    </main>
  );
}
