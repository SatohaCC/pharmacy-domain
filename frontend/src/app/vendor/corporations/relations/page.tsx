import type { Metadata } from "next";
import { Suspense } from "react";
import { CorporateRelationsContainer } from "@/features/corporate-relations/CorporateRelationsContainer";
import { Spinner } from "@/shared/ui/spinner/Spinner";

export const metadata: Metadata = {
  title: "法人間関係管理",
  description: "法人・個人開設者間の親子関係、関連会社、FC/VC 契約の一覧と履歴管理を行います。",
};

export default function VendorCorporateRelationsPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <Suspense fallback={<Spinner size="lg" label="法人間関係を読み込み中…" showLabel />}>
        <CorporateRelationsContainer />
      </Suspense>
    </main>
  );
}
