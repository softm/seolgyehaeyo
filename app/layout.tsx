import type { Metadata } from "next";
import RegistryShortcut from "@/components/registry-shortcut";
import "./globals.css";
export const metadata: Metadata = {
  title: "설계해요 — 의뢰자의 설계 동반자",
  description: "좋은 설계사무소를 고르고, 맡긴 일이 끝까지 잘 진행되도록. 비교부터 계약, 진행 기록과 자료 인수까지 함께해요.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body className="antialiased">{children}<RegistryShortcut /></body></html>;
}
