import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fdf6ee',
          100: '#f9e9d3',
          500: '#c2762a',
          700: '#8b4f14',
          900: '#3d200a',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
