import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          cyan:         '#53c7d6',  // PRIMARY: лого, hero, nav, active states
          'cyan-dark':  '#3fb4c3',  // hover для cyan
          'cyan-light': '#7dd9e5',  // soft backgrounds
          red:          '#f0366d',  // CTA: "Докладніше", "Вхід", action buttons
          'red-dark':   '#d42b5f',  // hover для red
          gold:         '#f9c01d',  // highlights, Стамбул overlay
          'gold-dark':  '#e0aa10',
          blue:         '#2d70b9',  // system buttons, Мілан overlay
          'blue-dark':  '#245d9c',
          dark:         '#1a1a2e',  // section titles, body text
          white:        '#ffffff',
          pink:         '#f7c5d0',  // soft backgrounds
        },
      },
      fontFamily: {
        heading: ['Montserrat', 'Impact', 'sans-serif'],
        body:    ['IBM Plex Sans', 'Inter', 'sans-serif'],
        mono:    ['IBM Plex Mono', 'monospace'],
      },
      borderRadius: {
        pill: '9999px',  // ВСІ кнопки Eurotrips — ЗАВЖДИ pill
        card: '10px',    // картки
        tile: '8px',     // теги, chips
      },
    },
  },
  plugins: [],
}
export default config
