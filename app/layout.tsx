import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://agentic-erp-eth.vercel.app"),
  title: "Agentic ERP — autonomous B2B procurement",
  description:
    "Open framework for autonomous, trust-minimized B2B agents. Identity on ENS, memory on 0G, escrow on Sepolia. Buyer and seller agents discover each other and settle without a human in every step.",
  openGraph: {
    title: "Agentic ERP",
    description:
      "Two autonomous agents trading B2B, with receipts. Identity on ENS, memory on 0G, escrow on Sepolia.",
    url: "https://agentic-erp-eth.vercel.app",
    siteName: "Agentic ERP",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 1200,
        alt: "Agentic ERP",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Agentic ERP",
    description:
      "Two autonomous agents trading B2B, with receipts. ENS · 0G · KeeperHub.",
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
