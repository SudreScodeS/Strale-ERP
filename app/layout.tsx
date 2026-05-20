import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Geist, Geist_Mono, Alumni_Sans } from 'next/font/google';
import { Sidebar } from './components/ui';
import { LayoutProvider } from './components/layout-context';
import { ServiceWorkerRegistration } from './components/ServiceWorkerRegistration';
import { NavigationProvider } from './components/NavigationProvider';
import { ToastProvider } from './components/ui/Toast';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
  preload: true,
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
  preload: false,
});

const alumniSans = Alumni_Sans({
  variable: '--font-alumni-sans',
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  title: {
    template: '%s | Elitium ERP',
    default: 'Elitium ERP — Sistema de Gestão Empresarial',
  },
  description:
    'Sistema ERP completo para gestão de vendas, estoque, financeiro e orçamentos.',
  openGraph: {
    title: 'Elitium ERP',
    description: 'Sistema ERP completo para gestão empresarial',
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://elitium.com.br',
    siteName: 'Elitium ERP',
    locale: 'pt_BR',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Elitium ERP',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Elitium ERP',
    description: 'Sistema ERP completo para gestão empresarial',
  },
  robots: {
    index: true,
    follow: true,
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || 'https://elitium.com.br',
  ),
  icons: {
    icon: '/Logo.svg',
    shortcut: '/Logo.svg',
    apple: '/Logo.svg',
  },
  manifest: '/manifest.json',
};

// Inline script to apply theme before React hydrates — avoids FOUC
const themeInitScript = `
(function(){
  try {
    var t = localStorage.getItem('erp-theme') || 'light';
    document.documentElement.setAttribute('data-theme', t);
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      dir="ltr"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${alumniSans.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full">
        <ServiceWorkerRegistration />
        <ToastProvider>
          <NavigationProvider>
            <LayoutProvider>
              <Sidebar>
                <div id="main-content">{children}</div>
              </Sidebar>
            </LayoutProvider>
          </NavigationProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
