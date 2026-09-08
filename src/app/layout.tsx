import type { Metadata } from "next";
import { Noto_Sans_TC } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const notoSansTc = Noto_Sans_TC({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "訪客服務機｜Visitor Kiosk",
  description: "訪客預約與現場報到",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant" className="h-full" suppressHydrationWarning>
      <body
        className={`${notoSansTc.className} min-h-dvh bg-(image:--shell-gradient) text-(--text-primary) antialiased`}
        suppressHydrationWarning
      >
        <Script src="/theme-init.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
