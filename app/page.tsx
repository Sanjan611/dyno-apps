import { Metadata } from "next";
import LandingPage from "@/components/landing-page";

export const metadata: Metadata = {
  title: "Dyno Apps - AI-Powered Mobile App Builder",
  description: "Build mobile applications using natural language with AI. Create, test, and deploy React Native apps instantly.",
  openGraph: {
    title: "Dyno Apps - Build Mobile Apps with AI",
    description: "Turn your ideas into fully functional mobile apps in minutes using AI.",
    type: "website",
    url: "https://dyno.app",
    siteName: "Dyno Apps",
    locale: "en_US",
    images: [
      {
        url: "/og-image.jpg", // Placeholder
        width: 1200,
        height: 630,
        alt: "Dyno Apps Preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dyno Apps - AI Mobile Builder",
    description: "Build mobile apps with AI in minutes.",
    images: ["/og-image.jpg"], // Placeholder
  },
};

export default function Home() {
  return <LandingPage />;
}
