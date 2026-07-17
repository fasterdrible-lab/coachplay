import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Identidade NEX-ALS — Dark Luxury UI
        ink: '#080612',
        ink2: '#0d0a24',
        gold: {
          DEFAULT: '#d9a441',
          bright: '#f2c879',
          dim: '#b8862f',
        },
        violet: '#b78dff',
      },
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', '-apple-system', 'sans-serif'],
      },
      backgroundImage: {
        'luxury-radial':
          'radial-gradient(880px 520px at 14% -8%, rgba(217,164,65,0.10), transparent 60%), radial-gradient(760px 520px at 108% 18%, rgba(183,141,255,0.09), transparent 55%), linear-gradient(160deg, #080612 0%, #151038 100%)',
      },
      boxShadow: {
        gold: '0 0 60px -12px rgba(217, 164, 65, 0.35)',
      },
    },
  },
  plugins: [],
};

export default config;
