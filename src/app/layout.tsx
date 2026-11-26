import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { AppLayout } from "@/components/layout/AppLayout";
import { Providers } from "@/components/providers";

// Geist, same as Nexus-TG. Exposed as --font-app for globals.css.
const geist = Geist({ subsets: ["latin"], variable: "--font-app", display: "swap" });

export const metadata: Metadata = {
  title: "Sendora",
  description: "Email Marketing Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={geist.variable} suppressHydrationWarning>
      {/* suppressHydrationWarning: extensions like Grammarly add attributes to <body> before React loads */}
      <body className={geist.className} suppressHydrationWarning>
        <Providers>
          <AppLayout>{children}</AppLayout>
        </Providers>
      </body>
    </html>
  );
}
