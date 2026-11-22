import * as stylex from "@stylexjs/stylex";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { TasksWorkspace } from "@/features/tasks/TasksWorkspace";
import { parseTaskFiltersFromSearchParams } from "@/features/tasks/taskFilters";
import { fetchInitialTasks } from "@/features/tasks/tasksServer";
import { Skeleton } from "@/shared/ui/skeleton/Skeleton";
import { Spinner } from "@/shared/ui/spinner/Spinner";
import { tasksPageStyles as s } from "./page.styles";

export const metadata: Metadata = {
  title: "タスク管理 | Next.js + FastAPI",
  description:
    "Next.js と FastAPI（SQLite 永続化）を連携したタスク管理のフルスタック CRUD リファレンスページです。",
};

export const dynamic = "force-dynamic";

type RawSearchParams = Record<string, string | string[] | undefined>;

async function TasksWorkspaceLoader({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<RawSearchParams>;
}) {
  const [rawSearchParams, requestHeaders] = await Promise.all([searchParamsPromise, headers()]);
  const initialFilters = parseTaskFiltersFromSearchParams(rawSearchParams);
  const initialTasks = await fetchInitialTasks(requestHeaders, initialFilters);

  return <TasksWorkspace initialTasks={initialTasks} initialFilters={initialFilters} />;
}

function TasksWorkspaceFallback() {
  return (
    <div {...stylex.props(s.fallbackLayout)}>
      <div {...stylex.props(s.fallbackCard)}>
        <Skeleton variant="text" lines={4} />
        <Skeleton variant="rectangular" height={120} />
      </div>
      <div {...stylex.props(s.fallbackColumn)}>
        <div {...stylex.props(s.fallbackCard)}>
          <Spinner showLabel label="タスクを読み込んでいます…" />
        </div>
        <Skeleton variant="rectangular" height={84} />
        <Skeleton variant="rectangular" height={84} />
        <Skeleton variant="rectangular" height={84} />
      </div>
    </div>
  );
}

/** タスク一覧・絞り込み・作成・編集・削除を行うフルスタック CRUD ページ。 */
export default function TasksPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  return (
    <div {...stylex.props(s.page)}>
      <header {...stylex.props(s.header)}>
        <Link href="/" {...stylex.props(s.brand)}>
          <span aria-hidden="true" {...stylex.props(s.mark)}>
            &gt;_
          </span>
          <span lang="en" translate="no">
            Next.js + FastAPI Template
          </span>
        </Link>
        <nav aria-label="ページ遷移" {...stylex.props(s.nav)}>
          <Link href="/" {...stylex.props(s.link)}>
            トップページ
          </Link>
          <Link href="/tasks" aria-current="page" {...stylex.props(s.link, s.activeLink)}>
            タスク管理
          </Link>
        </nav>
      </header>

      <main id="main-content" tabIndex={-1}>
        <div {...stylex.props(s.hero)}>
          <p lang="en" translate="no" {...stylex.props(s.eyebrow)}>
            FULL-STACK CRUD / SQLITE
          </p>
          <h1 id="tasks-page-title" {...stylex.props(s.title)}>
            タスク管理
          </h1>
          <p {...stylex.props(s.description)}>
            Next.js App Router のサーバー初期取得と React Query、FastAPI + SQLite 永続化、共有 UI
            コンポーネントを組み合わせた CRUD リファレンス実装です。
          </p>
        </div>

        <Suspense fallback={<TasksWorkspaceFallback />}>
          <TasksWorkspaceLoader searchParamsPromise={searchParams} />
        </Suspense>
      </main>

      <footer {...stylex.props(s.footer)}>
        <span lang="en" translate="no">
          Next.js + FastAPI Template
        </span>
        <Link href="/" {...stylex.props(s.link)}>
          トップページへ戻る
        </Link>
      </footer>
    </div>
  );
}
