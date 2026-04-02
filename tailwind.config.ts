import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // ─── Fonts ────────────────────────────────────────────────
      fontFamily: {
        sans:    ['DM Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['DM Serif Display', 'Georgia', 'Times New Roman', 'serif'],
        mono:    ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
      },

      // ─── Font Sizes ───────────────────────────────────────────
      fontSize: {
        'xs':   ['0.6875rem', { lineHeight: '1rem' }],
        'sm':   ['0.8125rem', { lineHeight: '1.25rem' }],
        'base': ['0.9375rem', { lineHeight: '1.6' }],
        'md':   ['1rem',      { lineHeight: '1.6' }],
        'lg':   ['1.125rem',  { lineHeight: '1.5' }],
        'xl':   ['1.25rem',   { lineHeight: '1.4' }],
        '2xl':  ['1.5rem',    { lineHeight: '1.3' }],
        '3xl':  ['1.875rem',  { lineHeight: '1.25' }],
        '4xl':  ['2.25rem',   { lineHeight: '1.2' }],
        '5xl':  ['3rem',      { lineHeight: '1.1' }],
      },

      // ─── Font Weights ──────────────────────────────────────────
      fontWeight: {
        light:    '300',
        regular:  '400',
        medium:   '500',
        semibold: '600',
      },

      // ─── Letter Spacing ────────────────────────────────────────
      letterSpacing: {
        tight:   '-0.025em',
        snug:    '-0.015em',
        base:    '-0.005em',
        wide:     '0.04em',
        widest:   '0.1em',
      },

      // ─── Colors ───────────────────────────────────────────────
      colors: {
        brand: {
          navy: {
            50:  '#EFF5FB',
            100: '#DAE9F5',
            200: '#B4CDE8',
            300: '#7AAAD4',
            400: '#4A7FC0',
            500: '#2C61A8',
            600: '#255090',
            700: '#1E4070',
            800: '#173058',
            900: '#0F2040',
            950: '#0A1628',
          },
          gold: {
            50:  '#FDF5E6',
            100: '#FAE5B8',
            200: '#F2CB7A',
            300: '#E6AC40',
            400: '#D4921A',
            500: '#C07B00',
            700: '#7A4D00',
            900: '#3D2600',
          },
          slate: {
            50:  '#F5F6F9',
            100: '#EAECF2',
            200: '#D4D8E2',
            300: '#B0B6C6',
            400: '#8890A6',
            500: '#636B84',
            600: '#4A5168',
            700: '#343A4F',
            800: '#252A3A',
            900: '#1A1E2E',
          },
        },

        // Semantic
        success: {
          DEFAULT: '#0E8255',
          dark:    '#0A5E3A',
          mid:     '#1CAF72',
          light:   '#D0F0E3',
          bg:      '#F0FAF5',
        },
        warning: {
          DEFAULT: '#B86200',
          dark:    '#7A4200',
          mid:     '#E07A00',
          light:   '#FDDEA8',
          bg:      '#FFF8EC',
        },
        danger: {
          DEFAULT: '#B82828',
          dark:    '#7C1A1A',
          mid:     '#D94040',
          light:   '#FBCFCF',
          bg:      '#FFF3F3',
        },
        info: {
          DEFAULT: '#1A5FAA',
          dark:    '#0A3D72',
          mid:     '#3A82D4',
          light:   '#BDD8F4',
          bg:      '#EEF6FD',
        },

        // Surfaces
        canvas:  '#F4F6FA',
        surface: {
          primary:   '#FFFFFF',
          secondary: '#F8F9FC',
          tertiary:  '#F0F2F7',
        },
      },

      // ─── Border Radius ─────────────────────────────────────────
      borderRadius: {
        none: '0',
        xs:   '2px',
        sm:   '4px',
        md:   '8px',
        lg:   '12px',
        xl:   '16px',
        '2xl':'20px',
        '3xl':'28px',
        full: '9999px',
      },

      // ─── Box Shadows ───────────────────────────────────────────
      boxShadow: {
        xs:     '0 1px 2px 0 rgba(10, 22, 40, 0.04)',
        sm:     '0 1px 3px 0 rgba(10, 22, 40, 0.06), 0 1px 2px -1px rgba(10, 22, 40, 0.04)',
        md:     '0 4px 8px -2px rgba(10, 22, 40, 0.08), 0 2px 4px -2px rgba(10, 22, 40, 0.05)',
        lg:     '0 10px 24px -4px rgba(10, 22, 40, 0.10), 0 4px 8px -4px rgba(10, 22, 40, 0.06)',
        xl:     '0 20px 40px -8px rgba(10, 22, 40, 0.12), 0 8px 16px -6px rgba(10, 22, 40, 0.07)',
        '2xl':  '0 32px 64px -12px rgba(10, 22, 40, 0.15), 0 12px 24px -8px rgba(10, 22, 40, 0.08)',
        brand:  '0 4px 20px -4px rgba(28, 72, 130, 0.25)',
        'brand-lg':'0 8px 30px -6px rgba(28, 72, 130, 0.30)',
        accent: '0 4px 20px -4px rgba(192, 123, 0, 0.22)',
        focus:  '0 0 0 3px rgba(44, 97, 168, 0.22)',
        'focus-danger': '0 0 0 3px rgba(185, 40, 40, 0.20)',
        inset:  'inset 0 1px 3px 0 rgba(10, 22, 40, 0.08)',
        none:   'none',
      },

      // ─── Spacing ───────────────────────────────────────────────
      spacing: {
        '0.5':  '0.125rem',
        '1':    '0.25rem',
        '1.5':  '0.375rem',
        '2':    '0.5rem',
        '2.5':  '0.625rem',
        '3':    '0.75rem',
        '3.5':  '0.875rem',
        '4':    '1rem',
        '5':    '1.25rem',
        '6':    '1.5rem',
        '7':    '1.75rem',
        '8':    '2rem',
        '10':   '2.5rem',
        '12':   '3rem',
        '14':   '3.5rem',
        '16':   '4rem',
        '20':   '5rem',
        '24':   '6rem',
        // App shell dimensions
        sidebar:         '260px',
        'sidebar-collapsed': '72px',
        topbar:          '64px',
      },

      // ─── Transitions ───────────────────────────────────────────
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
        in:     'cubic-bezier(0.4, 0, 1, 1)',
        out:    'cubic-bezier(0, 0, 0.2, 1)',
      },
      transitionDuration: {
        instant: '60ms',
        fast:    '120ms',
        base:    '200ms',
        slow:    '320ms',
        slower:  '500ms',
      },

      // ─── Animations ────────────────────────────────────────────
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(24px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.92)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        'modal-in': {
          from: { opacity: '0', transform: 'scale(0.92) translateY(20px)' },
          to:   { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateX(110%)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        'spin': {
          to:   { transform: 'rotate(360deg)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.6' },
        },
        'shimmer': {
          from: { backgroundPosition: '-400px 0' },
          to:   { backgroundPosition: '400px 0' },
        },
      },
      animation: {
        'fade-in':       'fade-in 200ms ease-out',
        'fade-up':       'fade-up 320ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'slide-right':   'slide-in-right 250ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'scale-in':      'scale-in 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'modal-in':      'modal-in 320ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'toast-in':      'toast-in 320ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'spin':          'spin 0.65s linear infinite',
        'pulse-soft':    'pulse-soft 2s ease-in-out infinite',
        'shimmer':       'shimmer 1.5s linear infinite',
      },

      // ─── Backdrop Blur ─────────────────────────────────────────
      backdropBlur: {
        topbar: '20px',
      },

      // ─── Z-Index ───────────────────────────────────────────────
      zIndex: {
        base:     '0',
        raised:   '10',
        dropdown: '100',
        sticky:   '200',
        overlay:  '300',
        modal:    '400',
        toast:    '500',
        tooltip:  '600',
      },
    },
  },
  plugins: [],
}

export default config