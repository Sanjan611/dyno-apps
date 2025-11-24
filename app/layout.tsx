import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dyno Apps - AI-Powered Mobile App Builder",
  description: "Build mobile applications using natural language with AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
