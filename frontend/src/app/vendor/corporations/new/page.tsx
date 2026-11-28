import type { Metadata } from "next";
import { CorporationFormContainer } from "@/features/corporations/CorporationFormContainer";

export const metadata: Metadata = {
  title: "新規企業（法人・個人開設者）の登録",
  description: "薬局を開設する法人または個人開設者を新規登録します。",
};

export default function NewVendorCorporationPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <CorporationFormContainer mode="create" />
    </main>
  );
}
