import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Sidebar } from './components/ui';
import { LayoutProvider } from './components/layout-context';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Elitium',
  description: 'Premium ERP — Gestão empresarial de nova geração.',
  icons: {
    icon: '/elitium-mark.svg',
    shortcut: '/elitium-mark.svg',
    apple: '/elitium-mark.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <LayoutProvider>
          <Sidebar>{children}</Sidebar>
        </LayoutProvider>
      </body>
    </html>
  );
}
