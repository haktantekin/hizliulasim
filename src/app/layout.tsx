import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import '../styles/globals.css';
import QueryProvider from '../components/prodivers/QueryProvider';
import ReduxProvider from '../components/providers/ReduxProvider';
import BottomBar from '../components/ui/BottomBar';
import Header from '../components/ui/Header';
import Footer from '../components/ui/Footer';
import Script from "next/script";

const outfit = Outfit({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://hizliulasim.com'),
  title: {
    default: 'Hızlı Ulaşım',
    template: '%s | Hızlı Ulaşım',
  },
  description: 'Toplu taşıma, rota ve şehir yaşamı hakkında pratik bilgileri keşfedin.',
  applicationName: 'Hızlı Ulaşım',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
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

export const viewport: Viewport = {
  themeColor: '#272445',
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
        <Script
          id="schema-website"
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
        <Script
          id="schema-organization"
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
           <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-XJ33LRDG0G"
        strategy="afterInteractive"
      />
      <Script id="ga-setup" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){window.dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-XJ33LRDG0G');
        `}
      </Script>
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
