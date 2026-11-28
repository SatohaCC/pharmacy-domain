import type { Metadata } from "next";
import { CorporationFormContainer } from "@/features/corporations/CorporationFormContainer";

export const metadata: Metadata = {
  title: "導入企業（法人・個人開設者）の基本情報編集",
  description: "登録済み企業の基本情報（名称・代表者名・法人番号・所在地・有効期間）を編集します。",
};

export default async function EditVendorCorporationPage({
  params,
}: {
  params: Promise<{ corporationId: string }>;
}) {
  const { corporationId } = await params;
  return (
    <main id="main-content" tabIndex={-1}>
      <CorporationFormContainer mode="edit" corporationId={corporationId} />
    </main>
  );
}
