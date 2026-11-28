import type { Metadata } from "next";
import { CorporationFormContainer } from "@/features/corporations/CorporationFormContainer";

export const metadata: Metadata = {
  title: "導入企業（法人・個人開設者）の編集・管理",
  description: "登録済み企業の基本情報編集、システム利用状態の切替、変更履歴・状態管理を行います。",
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
