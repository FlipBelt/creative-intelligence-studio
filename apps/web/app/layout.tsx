import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
 title: "CIS — Creative Intelligence Studio",
 description: "从产品理解到创意方向，连接参考、决策与创作的工作台。首版交互预览。",
 icons: { icon: "/favicon.svg" },
 robots: { index: false, follow: false }
};
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
 return <html lang="zh-CN"><body>{children}</body></html>;
}
