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

export const metadata: Metadata = {
  title: "Apio — Real-time API Monitoring",
  description: "Apio gives engineering teams real-time visibility into every API call. Monitor uptime, latency, and errors across all your microservices with a single command.",
  icons: {
    // SVG works at all sizes, perfectly crisp in browser tabs
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.svg', sizes: '32x32',  type: 'image/svg+xml' },
      { url: '/favicon.svg', sizes: '16x16',  type: 'image/svg+xml' },
    ],
    // Apple touch icon (home screen on iOS)
    apple: { url: '/favicon.svg', type: 'image/svg+xml' },
    // Shortcut fallback for older browsers
    shortcut: '/favicon.svg',
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
