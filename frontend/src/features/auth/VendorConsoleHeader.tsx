"use client";

import * as stylex from "@stylexjs/stylex";
import Link from "next/link";
import { Badge } from "@/shared/ui/badge/Badge";
import { Button } from "@/shared/ui/button/Button";
import type { AuthRole, AuthUser } from "./schemas";
import { vendorConsoleHeaderStyles as s } from "./VendorConsoleHeader.styles";

export function formatAuthRoleLabel(role: AuthRole): string {
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

export interface VendorConsoleHeaderProps {
  title: string;
  activeSection: "corporations" | "relations" | "users";
  currentUser: AuthUser;
  isLoggingOut: boolean;
  onLogout: () => void;
}

/** ベンダーコンソール共通ヘッダーおよびセクション切り替えナビゲーション。 */
export function VendorConsoleHeader({
  title,
  activeSection,
  currentUser,
  isLoggingOut,
  onLogout,
}: VendorConsoleHeaderProps) {
  return (
    <header {...stylex.props(s.topBar)}>
      <div {...stylex.props(s.topRow)}>
        <div {...stylex.props(s.identity)}>
          <p {...stylex.props(s.eyebrow)}>SYSTEM VENDOR CONSOLE</p>
          <div {...stylex.props(s.titleRow)}>
            <h1 {...stylex.props(s.heading)}>{title}</h1>
            {currentUser.roles.map((role) => (
              <Badge key={role} tone={role === "vendor_admin" ? "success" : "neutral"}>
                {formatAuthRoleLabel(role)}
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
      </div>

      <nav aria-label="ベンダーコンソール" {...stylex.props(s.navBar)}>
        <Link
          href="/vendor/corporations"
          aria-current={activeSection === "corporations" ? "page" : undefined}
          {...stylex.props(s.navLink, activeSection === "corporations" && s.navLinkActive)}
        >
          法人管理
        </Link>
        <Link
          href="/vendor/corporations/relations"
          aria-current={activeSection === "relations" ? "page" : undefined}
          {...stylex.props(s.navLink, activeSection === "relations" && s.navLinkActive)}
        >
          法人間関係
        </Link>
        <Link
          href="/vendor/users"
          aria-current={activeSection === "users" ? "page" : undefined}
          {...stylex.props(s.navLink, activeSection === "users" && s.navLinkActive)}
        >
          ベンダー社員管理
        </Link>
      </nav>
    </header>
  );
}
