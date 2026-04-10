import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { AuthGate } from "@/components/AuthGate";

export const metadata: Metadata = {
  title: "引力内部热点脚本工作台",
  description: "实时热点聚合与信息流广告脚本创作",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-[#0c0f14] font-sans antialiased">
        <Nav />
        <main className="mx-auto max-w-6xl px-4 pb-16 pt-8">
          <AuthGate>
            {children}
          </AuthGate>
        </main>
      </body>
    </html>
  );
}
