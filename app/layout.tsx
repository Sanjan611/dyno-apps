import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

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
      <body className={`${inter.className} antialiased bg-slate-50 relative min-h-screen overflow-x-hidden`}>
        {/* Global Background Layer */}
        <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
           {/* Base Gradient */}
           <div className="absolute inset-0 bg-gradient-to-b from-slate-50 to-white" />
           
           {/* Grid Pattern */}
           <div className="absolute inset-0 bg-grid-pattern opacity-[0.4]" />

           {/* Fixed Geometric Shapes */}
           <div className="absolute top-[-5%] left-[-5%] w-[30vw] h-[30vw] bg-primary/5 rounded-full" />
           <div className="absolute bottom-[-5%] right-[-5%] w-[35vw] h-[35vw] bg-secondary/5 rounded-3xl rotate-12" />
           
           <div className="absolute top-[40%] left-[5%] w-[15vw] h-[15vw] bg-blue-400/5 rounded-full" />
           <div className="absolute top-[10%] right-[10%] w-[12vw] h-[12vw] bg-purple-400/5 rounded-3xl -rotate-6" />
           
           {/* Geometric Accents */}
           <div className="absolute top-[20%] left-[15%] w-16 h-16 bg-primary/10 rounded-full" />
           <div className="absolute bottom-[30%] right-[20%] w-24 h-24 bg-secondary/10 rounded-xl rotate-45" />
           <div className="absolute top-[70%] left-[25%] w-12 h-12 bg-blue-500/10 rounded-full" />
        </div>

        {children}
      </body>
    </html>
  );
}
