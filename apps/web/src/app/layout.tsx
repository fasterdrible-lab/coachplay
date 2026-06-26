import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '../providers/auth-provider';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Coach Play — Analise sua partida de EA FC',
  description: 'Plataforma de análise de partidas de EA FC com IA. Identifique seus erros e melhore seu jogo.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
