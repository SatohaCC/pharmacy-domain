import type { Metadata } from "next";
import { LoginContainer } from "@/features/auth/LoginContainer";

export const metadata: Metadata = {
  title: "システムベンダーログイン",
  description: "システムベンダー向けアカウントでログインします。",
};

export default function VendorLoginPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <LoginContainer />
    </main>
  );
}
