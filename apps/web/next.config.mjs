/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Em dev, o Next descarta do cache de compilação páginas inativas depois de
  // ~25s (default). Com múltiplas abas abertas, voltar para uma aba parada
  // dispara uma recompilação nesse instante — o efeito visível é a tela ficar
  // em branco por um instante. Aumentando a janela isso fica bem mais raro.
  onDemandEntries: {
    maxInactiveAge: 60 * 60 * 1000,
    pagesBufferLength: 10,
  },
};

export default nextConfig;
