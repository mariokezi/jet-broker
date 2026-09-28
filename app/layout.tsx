import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/components/store-provider";
import { AppShell } from "@/components/app-shell";
import { getDataContext } from "@/lib/data-mode";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JetBroker | Charter Operations",
  description: "Private jet charter brokerage: inquiry qualification, quote aggregation, proposals, and scheduling",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { mode, outlookLinked } = await getDataContext();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-canvas text-slate-900">
        <StoreProvider mode={mode}>
          <AppShell mode={mode} outlookLinked={outlookLinked}>
            {children}
          </AppShell>
        </StoreProvider>
      </body>
    </html>
  );
}
