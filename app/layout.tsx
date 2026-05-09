import type { Metadata } from "next";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

// Resolve a stable canonical URL so OG/Twitter unfurls find the right image.
// Order: explicit override → Vercel preview deploy → localhost.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000')

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "What's Building SF",
    template: "%s · What's Building SF",
  },
  description:
    'Every major new-construction permit filed in San Francisco in the last 2 years, mapped.',
  openGraph: {
    siteName: "What's Building SF",
    type: 'website',
    locale: 'en_US',
    title: "What's Building SF",
    description:
      'Every major new-construction permit filed in San Francisco in the last 2 years, mapped.',
  },
  twitter: {
    card: 'summary_large_image',
    title: "What's Building SF",
    description:
      'Every major new-construction permit filed in San Francisco in the last 2 years, mapped.',
  },
  alternates: {
    types: {
      'application/atom+xml': '/feed.xml',
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">{children}</body>
    </html>
  );
}
