import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import PreventNumberInputScroll from "@/components/prevent-number-input-scroll";
import AccountAccessGuard from "@/components/account-access-guard";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JORO Inventory",
  description: "Hotel stock and inventory management",
};

const themeScript = `
  (() => {
    const preference = localStorage.getItem("hotel-inventory-theme") || "system";
    const isDark = preference === "dark" ||
      (preference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.classList.toggle("light", !isDark);
  })();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <PreventNumberInputScroll />
        <AccountAccessGuard />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
