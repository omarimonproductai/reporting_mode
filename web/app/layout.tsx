import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Suspense } from "react";
import { Footer } from "@/components/Footer";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Cooltra Reporting Platform",
  description: "Manage scheduled briefs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ca"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <div className="flex min-h-screen">
          <aside className="w-[280px] shrink-0 border-r border-zinc-200 bg-white flex flex-col">
            {/* BriefSidebar lands here in task 2.6 */}
            <div className="flex-1 p-4 text-sm text-zinc-400">
              Sidebar (placeholder)
            </div>
            <Suspense
              fallback={
                <div className="px-4 py-3 text-[11px] text-zinc-400 font-mono">
                  Loading version…
                </div>
              }
            >
              <Footer />
            </Suspense>
          </aside>

          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
