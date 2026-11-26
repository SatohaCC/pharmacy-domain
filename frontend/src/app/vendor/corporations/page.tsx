import type { Metadata } from "next";
import { CorporationsContainer } from "@/features/corporations/CorporationsContainer";

export const metadata: Metadata = {
  title: "導入企業（法人・個人開設者）管理",
  description: "薬局を開設する法人・個人開設者の登録、検索、基本情報の管理を行います。",
};

export default function VendorCorporationsPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <CorporationsContainer />
    </main>
  );
}
