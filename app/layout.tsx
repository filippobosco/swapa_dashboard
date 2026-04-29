import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Swapa Dashboard",
  description: "Dashboard di reporting Swapa — Filante Motors",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className="h-full">
      <body className={`${inter.className} min-h-full`} style={{ backgroundColor: "#F8F9FB" }}>
        {children}
      </body>
    </html>
  );
}
