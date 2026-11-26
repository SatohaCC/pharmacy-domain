import type { Metadata } from "next";
import { VendorUsersContainer } from "@/features/vendor-auth/VendorUsersContainer";

export const metadata: Metadata = {
  title: "ベンダーアカウント管理",
  description: "システムベンダー社員アカウントの発行と一覧管理を行います。",
};

export default function VendorUsersPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <VendorUsersContainer />
    </main>
  );
}
