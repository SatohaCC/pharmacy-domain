import * as stylex from "@stylexjs/stylex";
import { Spinner } from "@/shared/ui/spinner/Spinner";
import { statusPageStyles as s } from "./status-page.styles";

/** ルート遷移時に表示する標準ローディング UI。 */
export default function Loading() {
  return (
    <main id="main-content" tabIndex={-1} {...stylex.props(s.page)}>
      <div role="status" aria-live="polite" aria-busy="true" {...stylex.props(s.loadingBox)}>
        <Spinner size="md" decorative />
        <span>読み込み中…</span>
      </div>
    </main>
  );
}
