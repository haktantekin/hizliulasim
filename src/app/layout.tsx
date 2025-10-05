import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import '../styles/globals.css';
import QueryProvider from '../components/prodivers/QueryProvider';
import ReduxProvider from '../components/providers/ReduxProvider';
import BottomBar from '../components/ui/BottomBar';
import Header from '../components/ui/Header';
import Footer from '../components/ui/Footer';

const outfit = Outfit({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://hizliulasim.com'),
  title: {
    default: 'Hızlı Ulaşım',
    template: '%s | Hızlı Ulaşım',
  },
  description: 'Toplu taşıma, rota ve şehir yaşamı hakkında pratik bilgileri keşfedin.',
  applicationName: 'Hızlı Ulaşım',
  themeColor: '#272445',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180' },
    ],
  },
  openGraph: {
    siteName: 'Hızlı Ulaşım',
    locale: 'tr_TR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hizliulasim.com';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* JSON-LD: WebSite + SearchAction */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'Hızlı Ulaşım',
              url: SITE_URL,
              potentialAction: {
                '@type': 'SearchAction',
                target: `${SITE_URL}/blog?query={search_term_string}`,
                'query-input': 'required name=search_term_string',
              },
            }),
          }}
        />
        {/* JSON-LD: Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Hızlı Ulaşım',
              url: SITE_URL,
            }),
          }}
        />
      </head>
  <body className={outfit.className}>
        <ReduxProvider>
          <QueryProvider>
            <Header />
            <div className="min-h-screen pt-12">
              {children}
            </div>
            <Footer />
            {/* Spacer to avoid BottomBar overlaying the footer */}
            <div aria-hidden className="h-16" />
            <BottomBar />
          </QueryProvider>
        </ReduxProvider>
      </body>
    </html>
  );
}
