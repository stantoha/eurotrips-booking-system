import type { Config } from 'tailwindcss'

/**
 * Міст Tailwind ↔ токени дизайн-системи.
 * Значення НЕ дублюються тут — вони читаються з CSS-змінних, оголошених
 * у src/styles/globals.css (синхронізовано з «Eurotrips Design System»).
 * Тому зміна теми/бренду робиться в ОДНОМУ місці — globals.css.
 *
 * Бренд-утиліти (brand-cyan, brand-red…) лишаються для сумісності з
 * наявним кодом; нові семантичні (surface-1, text-secondary, border-base)
 * — рекомендований спосіб для нового коду, бо вони реагують на тему.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Бренд-константи (звірено: брендбук + eurotrips.ua) ──
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

        // ── Семантичні поверхні (реагують на світлу/темну тему) ──
        page:      'var(--bg-page)',
        surface: {
          1:       'var(--surface-1)',
          2:       'var(--surface-2)',
          hover:   'var(--surface-hover)',
        },
        line: {
          DEFAULT: 'var(--border-1)',   // border-line
          strong:  'var(--border-2)',   // border-line-strong (hover / важче розділення)
        },
        content: {
          primary:   'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary:  'var(--text-tertiary)',
          inverse:   'var(--text-inverse)',
        },

        // ── Chrome: темний в ОБОХ темах (фіксований бренд-елемент) ──
        chrome: {
          DEFAULT: 'var(--chrome-bg)',
          fg:      'var(--chrome-fg)',
          muted:   'var(--chrome-fg-muted)',
          divider: 'var(--chrome-divider)',
          accent:  'var(--chrome-accent)',
        },

        // ── Статусний ramp (окремий від бренду) ──
        status: {
          info:             'var(--status-info)',
          'info-fg':        'var(--status-info-fg)',
          'info-bg':        'var(--status-info-bg)',
          'info-border':    'var(--status-info-border)',
          warning:          'var(--status-warning)',
          'warning-fg':     'var(--status-warning-fg)',
          'warning-bg':     'var(--status-warning-bg)',
          'warning-border': 'var(--status-warning-border)',
          success:          'var(--status-success)',
          'success-fg':     'var(--status-success-fg)',
          'success-bg':     'var(--status-success-bg)',
          'success-border': 'var(--status-success-border)',
          danger:           'var(--status-danger)',
          'danger-fg':      'var(--status-danger-fg)',
          'danger-bg':      'var(--status-danger-bg)',
          'danger-border':  'var(--status-danger-border)',
          neutral:          'var(--status-neutral)',
          'neutral-fg':     'var(--status-neutral-fg)',
          'neutral-bg':     'var(--status-neutral-bg)',
          'neutral-border': 'var(--status-neutral-border)',
        },
      },

      fontFamily: {
        heading: ['Montserrat', 'Impact', 'sans-serif'],
        body:    ['IBM Plex Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono:    ['IBM Plex Mono', 'SFMono-Regular', 'monospace'],
      },

      // Щільна B2B-шкала: body 13px, таблиці 12px, caption 11px, eyebrow 10px
      fontSize: {
        display: ['var(--text-display)', { lineHeight: 'var(--lh-display)' }],
        h1:      ['var(--text-h1)',      { lineHeight: 'var(--lh-h1)' }],
        h2:      ['var(--text-h2)',      { lineHeight: 'var(--lh-h2)' }],
        h3:      ['var(--text-h3)',      { lineHeight: 'var(--lh-h3)' }],
        h4:      ['var(--text-h4)',      { lineHeight: 'var(--lh-h4)' }],
        lg:      ['var(--text-lg)',      { lineHeight: 'var(--lh-lg)' }],
        body:    ['var(--text-body)',    { lineHeight: 'var(--lh-body)' }],
        sm:      ['var(--text-sm)',      { lineHeight: 'var(--lh-sm)' }],
        caption: ['var(--text-caption)', { lineHeight: 'var(--lh-caption)' }],
        micro:   ['var(--text-micro)',   { lineHeight: 'var(--lh-micro)' }],
      },

      letterSpacing: {
        logo:    'var(--tracking-logo)',
        eyebrow: 'var(--tracking-eyebrow)',
      },

      borderRadius: {
        pill:  'var(--radius-pill)',  // ВСІ кнопки Eurotrips — ЗАВЖДИ pill
        card:  'var(--radius-card)',
        tile:  'var(--radius-tile)',
        panel: 'var(--radius-lg)',    // панелі/модалки 12px (не чіпаємо вбудований rounded-lg)
      },

      boxShadow: {
        xs:    'var(--shadow-xs)',
        sm:    'var(--shadow-sm)',
        md:    'var(--shadow-md)',
        lg:    'var(--shadow-lg)',
        focus: 'var(--shadow-focus)',
      },

      // Константи шелу з дизайн-системи
      spacing: {
        topbar:  'var(--topbar-h)',   // 52px
        sidebar: 'var(--sidebar-w)',  // 212px
        page:    'var(--page-pad)',   // 24px
      },
      maxWidth: {
        content: 'var(--content-max)', // 1400px
      },

      transitionDuration: {
        fast: '150ms',
        base: '200ms',
        slow: '300ms',
      },

      keyframes: {
        'et-ping':    { '75%,100%': { transform: 'scale(2)', opacity: '0' } },
        'et-shimmer': { '0%': { backgroundPosition: '-320px 0' }, '100%': { backgroundPosition: '320px 0' } },
      },
      animation: {
        'et-ping':    'et-ping 1.4s cubic-bezier(0,0,.2,1) infinite',
        'et-shimmer': 'et-shimmer 1.4s linear infinite',
      },
    },
  },
  plugins: [],
}
export default config
