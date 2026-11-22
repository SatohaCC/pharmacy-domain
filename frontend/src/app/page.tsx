import * as stylex from "@stylexjs/stylex";
import Link from "next/link";
import { HealthStatusContainer } from "@/features/health/HealthStatusContainer";
import { pageStyles as s } from "./page.styles";

const layers = [
  { name: "Next.js", path: "frontend/src/app/", description: "画面とルーティングを実装する。" },
  {
    name: "FastAPI",
    path: "backend/app/",
    description: "APIとアプリケーションロジックを実装する。",
  },
  {
    name: "共有 UI",
    path: "frontend/src/shared/ui/",
    description: "Material Design 3 の部品を再利用する。",
  },
];

export default function HomePage() {
  return (
    <div id="top" {...stylex.props(s.page)}>
      <header {...stylex.props(s.container, s.header)}>
        <a href="#top" {...stylex.props(s.brand)}>
          <span aria-hidden="true" {...stylex.props(s.mark)}>
            &gt;_
          </span>
          <span lang="en" translate="no">
            Next.js + FastAPI Template
          </span>
        </a>
        <nav aria-label="ページ内" {...stylex.props(s.nav)}>
          <Link href="/tasks" {...stylex.props(s.link)}>
            タスク管理
          </Link>
          <a href="#connection" {...stylex.props(s.link)}>
            接続状態
          </a>
          <a href="#structure" {...stylex.props(s.link)}>
            構成
          </a>
        </nav>
      </header>

      <main id="main-content" tabIndex={-1} {...stylex.props(s.container)}>
        <section {...stylex.props(s.hero)}>
          <div {...stylex.props(s.intro)}>
            <p lang="en" translate="no" {...stylex.props(s.eyebrow)}>
              NEXT.JS / FASTAPI
            </p>
            <h1 {...stylex.props(s.title)}>サンプルページ</h1>
            <p {...stylex.props(s.description)}>
              Next.jsの画面からFastAPIに接続するサンプルです。起動手順とプロジェクト構成を確認できます。
            </p>
            <a href="#connection" {...stylex.props(s.action)}>
              APIの接続を確認 <span aria-hidden="true">↓</span>
            </a>
          </div>

          <section {...stylex.props(s.terminal)}>
            <div {...stylex.props(s.terminalHeader)}>
              <span aria-hidden="true" {...stylex.props(s.terminalIcon)}>
                &gt;_
              </span>
              <h2>ローカルで起動</h2>
            </div>
            <p {...stylex.props(s.setupText)}>リポジトリのルートで実行します。</p>
            <pre {...stylex.props(s.commands)}>
              <code translate="no">{"pnpm install --frozen-lockfile\npnpm dev"}</code>
            </pre>
            <dl {...stylex.props(s.endpoints)}>
              <div {...stylex.props(s.endpoint)}>
                <dt>画面</dt>
                <dd>
                  <code translate="no">localhost:3000</code>
                </dd>
              </div>
              <div {...stylex.props(s.endpoint)}>
                <dt>ヘルス API</dt>
                <dd>
                  <code translate="no">/api/health</code>
                </dd>
              </div>
            </dl>
          </section>
        </section>

        <section id="connection" {...stylex.props(s.connection)}>
          <div>
            <h2 {...stylex.props(s.sectionTitle)}>接続状態</h2>
            <p {...stylex.props(s.support)}>ブラウザからFastAPIへの応答を確認します。</p>
          </div>
          <HealthStatusContainer />
        </section>

        <section id="structure" {...stylex.props(s.structure)}>
          <h2 {...stylex.props(s.sectionTitle)}>プロジェクト構成</h2>
          <ul {...stylex.props(s.layers)}>
            {layers.map(({ name, path, description }) => (
              <li key={path} {...stylex.props(s.layer)}>
                <h3 {...stylex.props(s.layerTitle)}>{name}</h3>
                <code translate="no" {...stylex.props(s.path)}>
                  {path}
                </code>
                <p {...stylex.props(s.support)}>{description}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer {...stylex.props(s.container, s.footer)}>
        <span lang="en" translate="no">
          Next.js + FastAPI Template
        </span>
        <a href="#top" {...stylex.props(s.link)}>
          ページ上部へ <span aria-hidden="true">↑</span>
        </a>
      </footer>
    </div>
  );
}
