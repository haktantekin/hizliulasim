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
    default: 'Hızlı Ulaşım - Ulaşım Rehberi, Rota Planlama ve Gezi Önerileri',
    template: '%s | Hızlı Ulaşım',
  },
  description: 'Türkiye\'nin en kapsamlı ulaşım rehberi. Toplu taşıma bilgileri, rota planlama, gezilecek yerler, blog yazıları ve şehir yaşamı hakkında güncel bilgiler.',
  keywords: ['ulaşım', 'toplu taşıma', 'rota planlama', 'harita', 'gezi rehberi', 'İstanbul ulaşım', 'otobüs saatleri', 'metro hatları', 'gezilecek yerler'],
  authors: [{ name: 'Hızlı Ulaşım' }],
  creator: 'Hızlı Ulaşım',
  publisher: 'Hızlı Ulaşım',
  applicationName: 'Hızlı Ulaşım',
  manifest: '/manifest.webmanifest',
  alternates: {
    canonical: 'https://hizliulasim.com',
  },
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
    title: 'Hızlı Ulaşım - Ulaşım Rehberi ve Rota Planlama',
    description: 'Türkiye\'nin en kapsamlı ulaşım rehberi. Toplu taşıma, rota planlama ve gezi önerileri.',
    url: 'https://hizliulasim.com',
    siteName: 'Hızlı Ulaşım',
    locale: 'tr_TR',
    type: 'website',
    images: [
      {
        url: '/android-chrome-512x512.png',
        width: 512,
        height: 512,
        alt: 'Hızlı Ulaşım',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hızlı Ulaşım',
    description: 'Ulaşım rehberi, rota planlama ve gezi önerileri',
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
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
    <html lang="tr">
      <head>
        {/* Preconnect to external domains */}
        <link rel="dns-prefetch" href="https://cms.hizliulasim.com" />
        <link rel="dns-prefetch" href="https://maps.googleapis.com" />
        <meta name="google-adsense-account" content="ca-pub-4699659657596975" />
        {/* AdSense Script */}
        <Script
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4699659657596975"
          strategy="afterInteractive"
          crossOrigin="anonymous"
        />
        {/* RSS Feed */}
        <link rel="alternate" type="application/rss+xml" title="Hızlı Ulaşım Blog RSS" href="/feed.xml" />
        
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
                target: `${SITE_URL}/kategoriler?query={search_term_string}`,
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
