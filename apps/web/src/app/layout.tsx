import type { Metadata } from "next";
import { Space_Grotesk, Inter, Fira_Code, JetBrains_Mono } from "next/font/google";
import "@/styles/tailwind.css";
import "@/styles/globals.scss";
import Providers from './_components/Providers';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

const firaCode = Fira_Code({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-fira-code',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

const BASE_URL = 'https://apio.one';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),

  // ── Core ───────────────────────────────────────────────────────
  title: {
    default: 'Apio — Real-time API Monitoring',
    template: '%s | Apio',           // page titles become "Dashboard | Apio"
  },
  description:
    'Apio gives engineering teams real-time visibility into every API call. Monitor uptime, latency, and errors across all your microservices with a single command.',
  keywords: [
    'API monitoring', 'real-time monitoring', 'API observability',
    'microservices monitoring', 'uptime monitoring', 'latency tracking',
    'error rate monitoring', 'API analytics', 'developer tools',
    'NestJS monitoring', 'Spring Boot monitoring', 'FastAPI monitoring',
  ],
  authors: [{ name: 'Apio', url: BASE_URL }],
  creator: 'Apio',
  publisher: 'Apio',

  // ── Canonical & Robots ─────────────────────────────────────────
  alternates: { canonical: '/' },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  // ── Open Graph (Facebook, LinkedIn, Slack, Discord previews) ───
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: BASE_URL,
    siteName: 'Apio',
    title: 'Apio — Real-time API Monitoring',
    description:
      'Real-time visibility into every API call. Monitor uptime, latency, and errors across all your microservices with a single command.',
    images: [
      {
        url: '/og-image.png',          // 1200×630px — create this image
        width: 1200,
        height: 630,
        alt: 'Apio — Real-time API Monitoring Dashboard',
      },
    ],
  },

  // ── Twitter / X Cards ──────────────────────────────────────────
  twitter: {
    card: 'summary_large_image',
    title: 'Apio — Real-time API Monitoring',
    description:
      'Monitor uptime, latency, and errors across all your microservices with a single command.',
    images: ['/og-image.png'],
    creator: '@apiodev',              // 🔁 Change to your Twitter handle
  },

  // ── Favicon ────────────────────────────────────────────────────
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple: { url: '/favicon.svg', type: 'image/svg+xml' },
    shortcut: '/favicon.svg',
  },

  // ── PWA / App metadata ─────────────────────────────────────────
  applicationName: 'Apio',
  category: 'technology',

  // ── Search Console Verification ────────────────────────────────
  verification: {
    google: 'PO-NtP-C13LizKa4nRbhBfTn_7GeLWc2lDWQwjC7BdM',
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
      className={`${spaceGrotesk.variable} ${inter.variable} ${firaCode.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Fix #16: only reset scroll on the landing page ('/')
             Dashboard pages have their own scroll containers and need to
             preserve scroll position between navigations. */}
        <script dangerouslySetInnerHTML={{ __html: `
          if (history.scrollRestoration) history.scrollRestoration = 'manual';
          if (location.pathname === '/') window.scrollTo(0, 0);
        `}} />
        {/* Favicon — SVG scales perfectly at any resolution */}
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.svg" sizes="any" />
        {/* JSON-LD Structured Data — Google rich results */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'Apio',
              applicationCategory: 'DeveloperApplication',
              operatingSystem: 'Web',
              url: 'https://apio.one',
              description:
                'Real-time API monitoring platform. Monitor uptime, latency, and errors across all your microservices with a single command.',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
              },
              creator: {
                '@type': 'Organization',
                name: 'Apio',
                url: 'https://apio.one',
              },
            }),
          }}
        />
        {/* Material Symbols — CDN loaded, next/font doesn't support variable icon fonts */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
