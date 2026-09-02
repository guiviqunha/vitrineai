import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? 'http://localhost:3000'),
  title: 'VitrineAI — Studio de Marketplace',
  description: 'Crie imagens, títulos e descrições que ajudam seus produtos a vender mais em marketplaces.',
  openGraph: {
    title: 'VitrineAI — Uma foto. Um anúncio completo.',
    description: 'Imagens, títulos, descrições e recomendações para vender melhor em marketplaces.',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VitrineAI — Uma foto. Um anúncio completo.',
    description: 'Imagens, títulos, descrições e recomendações para vender melhor em marketplaces.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body></html>;
}
