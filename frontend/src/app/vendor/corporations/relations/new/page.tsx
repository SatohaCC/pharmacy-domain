import type { Metadata } from "next";
import { CorporateRelationCreateContainer } from "@/features/corporate-relations/CorporateRelationCreateContainer";

export const metadata: Metadata = {
  title: "新規法人間関係の登録",
  description: "親子関係、関連会社、FC/VC 契約を根拠資料と有効期間付きで登録します。",
};

export default function NewCorporateRelationPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <CorporateRelationCreateContainer />
    </main>
  );
}
