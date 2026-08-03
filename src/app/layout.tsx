import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "数字人口播生成工具",
  description: "本地定制化数字人口播视频生成工具",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
