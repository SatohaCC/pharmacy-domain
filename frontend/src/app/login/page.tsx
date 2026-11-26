import type { Metadata } from "next";
import { VendorLoginContainer } from "@/features/vendor-auth/VendorLoginContainer";

export const metadata: Metadata = {
  title: "システムベンダーログイン",
  description: "システムベンダー向けアカウントでログインします。",
};

export default function VendorLoginPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <VendorLoginContainer />
    </main>
  );
}
