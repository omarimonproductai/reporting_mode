import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Suspense } from "react";
import { BriefSidebar } from "@/components/BriefSidebar";
import { Footer } from "@/components/Footer";
import { SidebarSkeleton } from "@/components/SidebarSkeleton";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DryRunProvider } from "@/hooks/useDryRun";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
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

export const dynamic = "force-dynamic";

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
        <TooltipProvider>
          <DryRunProvider>
            <div className="flex min-h-screen">
              <aside className="w-[280px] shrink-0 border-r border-zinc-200 bg-white flex flex-col">
                <div className="flex-1 overflow-y-auto">
                  <Suspense fallback={<SidebarSkeleton />}>
                    <BriefSidebar />
                  </Suspense>
                </div>
                <Suspense
                  fallback={
                    <div className="px-4 py-3 text-[11px] text-zinc-400 font-mono">
                      Carregant versió…
                    </div>
                  }
                >
                  <Footer />
                </Suspense>
              </aside>

              <main className="flex-1 overflow-y-auto">{children}</main>
            </div>
            <Toaster />
          </DryRunProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
