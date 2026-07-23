import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { AnalyticsInit } from "@/components/AnalyticsInit";

export const metadata: Metadata = {
  title: "CutMaster — 합판 재단 최적화",
  description:
    "합판 재단(컷리스트) 최적화 웹 앱. 부품을 입력하면 시트 배치와 절단 순서를 계산합니다. Google 로그인으로 클라우드에 저장하세요.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <AnalyticsInit />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
