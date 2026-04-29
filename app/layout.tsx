import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Sidebar } from './components/ui';
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
  title: 'Simple ERP',
  description: 'ERP modular para gestão empresarial com estoque, vendas, financeiro e notas fiscais.',
  icons: {
    icon: '/LogoE.svg',
    shortcut: '/LogoE.svg',
    apple: '/LogoE.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-50 text-slate-900 antialiased">
        <Sidebar>{children}</Sidebar>
      </body>
    </html>
  );
}
