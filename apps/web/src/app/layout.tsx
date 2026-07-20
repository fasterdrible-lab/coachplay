import type { Metadata } from 'next';
import { Inter, Sora } from 'next/font/google';
import { AuthProvider } from '../providers/auth-provider';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-body' });
const sora = Sora({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-display' });

export const metadata: Metadata = {
  title: 'Coach Play — Analise sua partida de EA FC',
  description: 'Plataforma de análise de partidas de EA FC com IA. Identifique seus erros e melhore seu jogo.',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} ${sora.variable} font-sans bg-ink text-[#f8f8fc] antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
