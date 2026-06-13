// ✅ Верифіковано: PDF брендбук Eurotrips + eurotrips.ua
export const BRAND = {
  colors: {
    cyan:      '#53c7d6',
    cyanDark:  '#3fb4c3',
    red:       '#f0366d',
    redDark:   '#d42b5f',
    gold:      '#f9c01d',
    goldDark:  '#e0aa10',
    blue:      '#2d70b9',
    blueDark:  '#245d9c',
    dark:      '#1a1a2e',
    white:     '#ffffff',
    pink:      '#f7c5d0',
  },
  // Tailwind utility класи для overlay турів (55% ширина знизу-зліва)
  overlayClass: {
    cyan: 'bg-brand-cyan',
    red:  'bg-brand-red',
    blue: 'bg-brand-blue',
    gold: 'bg-brand-gold',
  } as const,
  fonts: {
    heading: 'Montserrat',    // fallback для Druk Text (комерційний)
    body:    'IBM Plex Sans', // fallback для Proxima Nova (комерційний)
    mono:    'IBM Plex Mono',
  },
} as const

export type OverlayColor = keyof typeof BRAND.overlayClass
