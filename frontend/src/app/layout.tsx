import * as stylex from "@stylexjs/stylex";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { QueryProvider } from "@/shared/lib/query/QueryProvider";
import "./globals.css";
import { layoutStyles } from "./layout.styles";

export const metadata: Metadata = {
  title: "サンプルページ | Next.js + FastAPI",
  description: "Next.js + FastAPI starter template",
  other: {
    "text-scale": "scale",
  },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#101514" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ja">
      <body {...stylex.props(layoutStyles.body)}>
        <a href="#main-content" {...stylex.props(layoutStyles.skipLink)}>
          メインコンテンツへスキップ
        </a>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
