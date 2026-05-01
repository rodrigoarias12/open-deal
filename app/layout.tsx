import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://open-deal.vercel.app"),
  title: "Open Deal — agents that run the books",
  description:
    "Open Deal: the onchain protocol for autonomous B2B trade. Two agents, ENS identities, onchain policy, audit anchor on 0G, USDC escrow on Sepolia. The framework Anthropic's Project Deal said doesn't exist yet.",
  openGraph: {
    title: "Agents that run the books.",
    description:
      "Two autonomous agents trading B2B with receipts. ENS identity, onchain policy, audit anchor on 0G. The framework Anthropic's Project Deal said doesn't exist yet.",
    url: "https://open-deal.vercel.app",
    siteName: "Open Deal",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 1200,
        alt: "Open Deal — agents that run the books",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Open Deal — agents that run the books",
    description:
      "Two autonomous agents trading B2B with receipts. ENS · onchain policy · 0G audit. The framework Anthropic's Project Deal said doesn't exist.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Inter+Tight:ital,wght@0,400;0,500;0,600;1,400;1,500&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
