import type { Metadata } from "next";
import { CorporateRelationsContainer } from "@/features/corporate-relations/CorporateRelationsContainer";

export const metadata: Metadata = {
  title: "法人間関係管理",
  description: "法人・個人開設者間の親子関係、関連会社、FC/VC 契約の登録と履歴管理を行います。",
};

export default function VendorCorporateRelationsPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <CorporateRelationsContainer />
    </main>
  );
}
