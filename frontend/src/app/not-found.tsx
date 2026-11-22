import * as stylex from "@stylexjs/stylex";
import Link from "next/link";
import { statusPageStyles as s } from "./status-page.styles";

/** 存在しないルートや notFound() 呼び出し時に表示する 404 画面。 */
export default function NotFound() {
  return (
    <main id="main-content" tabIndex={-1} {...stylex.props(s.page)}>
      <section {...stylex.props(s.card)}>
        <p {...stylex.props(s.code)}>404</p>
        <h1 {...stylex.props(s.title)}>ページが見つかりません</h1>
        <p {...stylex.props(s.description)}>
          指定されたページは移動または削除された可能性があります。URL を確認してください。
        </p>
        <div {...stylex.props(s.actions)}>
          <Link href="/" {...stylex.props(s.homeLink)}>
            トップページへ戻る
          </Link>
        </div>
      </section>
    </main>
  );
}
