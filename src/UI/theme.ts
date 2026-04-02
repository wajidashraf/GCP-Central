/**
 * GCP Central — Design System Tokens
 * Use this as the single source of truth in TypeScript/JS components.
 * Every value here mirrors globals.css and tailwind.config.ts.
 */

export const theme = {
  // ─── Brand Colors ──────────────────────────────────────────────
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
    semantic: {
      success: { bg: '#F0FAF5', light: '#D0F0E3', mid: '#1CAF72', DEFAULT: '#0E8255', dark: '#0A5E3A' },
      warning: { bg: '#FFF8EC', light: '#FDDEA8', mid: '#E07A00', DEFAULT: '#B86200', dark: '#7A4200' },
      danger:  { bg: '#FFF3F3', light: '#FBCFCF', mid: '#D94040', DEFAULT: '#B82828', dark: '#7C1A1A' },
      info:    { bg: '#EEF6FD', light: '#BDD8F4', mid: '#3A82D4', DEFAULT: '#1A5FAA', dark: '#0A3D72' },
    },
    surface: {
      canvas:    '#F4F6FA',
      primary:   '#FFFFFF',
      secondary: '#F8F9FC',
      tertiary:  '#F0F2F7',
    },
    border: {
      subtle:  'rgba(15, 30, 55, 0.07)',
      default: 'rgba(15, 30, 55, 0.12)',
      strong:  'rgba(15, 30, 55, 0.22)',
    },
    text: {
      primary:     '#0F1823',
      secondary:   '#3D4A5C',
      muted:       '#6E7A8A',
      placeholder: '#9BAAB8',
      inverse:     '#FFFFFF',
    },
  },

  // ─── Typography ─────────────────────────────────────────────────
  font: {
    sans:    "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    display: "'DM Serif Display', Georgia, 'Times New Roman', serif",
    mono:    "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  },
  fontSize: {
    xs:   '0.6875rem',  // 11px
    sm:   '0.8125rem',  // 13px
    base: '0.9375rem',  // 15px
    md:   '1rem',       // 16px
    lg:   '1.125rem',   // 18px
    xl:   '1.25rem',    // 20px
    '2xl': '1.5rem',    // 24px
    '3xl': '1.875rem',  // 30px
    '4xl': '2.25rem',   // 36px
    '5xl': '3rem',      // 48px
  },

  // ─── Spacing ────────────────────────────────────────────────────
  space: {
    0:    '0',
    px:   '1px',
    0.5:  '0.125rem',
    1:    '0.25rem',
    1.5:  '0.375rem',
    2:    '0.5rem',
    2.5:  '0.625rem',
    3:    '0.75rem',
    3.5:  '0.875rem',
    4:    '1rem',
    5:    '1.25rem',
    6:    '1.5rem',
    7:    '1.75rem',
    8:    '2rem',
    10:   '2.5rem',
    12:   '3rem',
    14:   '3.5rem',
    16:   '4rem',
    20:   '5rem',
    24:   '6rem',
  },

  // ─── Border Radius ───────────────────────────────────────────────
  radius: {
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

  // ─── Shadows ─────────────────────────────────────────────────────
  shadow: {
    xs:     '0 1px 2px 0 rgba(10, 22, 40, 0.04)',
    sm:     '0 1px 3px 0 rgba(10, 22, 40, 0.06), 0 1px 2px -1px rgba(10, 22, 40, 0.04)',
    md:     '0 4px 8px -2px rgba(10, 22, 40, 0.08), 0 2px 4px -2px rgba(10, 22, 40, 0.05)',
    lg:     '0 10px 24px -4px rgba(10, 22, 40, 0.10), 0 4px 8px -4px rgba(10, 22, 40, 0.06)',
    xl:     '0 20px 40px -8px rgba(10, 22, 40, 0.12), 0 8px 16px -6px rgba(10, 22, 40, 0.07)',
    '2xl':  '0 32px 64px -12px rgba(10, 22, 40, 0.15), 0 12px 24px -8px rgba(10, 22, 40, 0.08)',
    brand:  '0 4px 20px -4px rgba(28, 72, 130, 0.25)',
    accent: '0 4px 20px -4px rgba(192, 123, 0, 0.22)',
    focus:  '0 0 0 3px rgba(44, 97, 168, 0.22)',
    'focus-danger': '0 0 0 3px rgba(185, 40, 40, 0.20)',
    inset:  'inset 0 1px 3px 0 rgba(10, 22, 40, 0.08)',
  },

  // ─── Easing ──────────────────────────────────────────────────────
  ease: {
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
    in:     'cubic-bezier(0.4, 0, 1, 1)',
    out:    'cubic-bezier(0, 0, 0.2, 1)',
  },

  // ─── Duration ────────────────────────────────────────────────────
  duration: {
    instant: 60,
    fast:    120,
    base:    200,
    slow:    320,
    slower:  500,
  },

  // ─── Layout ──────────────────────────────────────────────────────
  layout: {
    sidebarWidth:     260,
    sidebarCollapsed: 72,
    topbarHeight:     64,
    contentMax:       1100,
  },

  // ─── Z-Index ─────────────────────────────────────────────────────
  z: {
    base:     0,
    raised:   10,
    dropdown: 100,
    sticky:   200,
    overlay:  300,
    modal:    400,
    toast:    500,
    tooltip:  600,
  },
} as const

export type Theme = typeof theme

// ─── Request Status Map ────────────────────────────────────────────
// Maps GCP/GCPC outcome codes to their display labels and badge variants
export const REQUEST_STATUS = {
  NEW:  { label: 'New',          variant: 'badge--new',     dot: 'blue'  },
  R:    { label: 'In Review',    variant: 'badge--brand',   dot: 'blue'  },
  ACK:  { label: 'Acknowledged', variant: 'badge--ack',     dot: 'green' },
  E:    { label: 'Endorsed',     variant: 'badge--endorse', dot: 'green' },
  RS:   { label: 'Resubmission', variant: 'badge--rs',      dot: 'amber' },
  NC:   { label: 'Non-Compliant',variant: 'badge--nc',      dot: 'red'   },
  NC3:  { label: 'NC (Code 3)',  variant: 'badge--nc',      dot: 'red'   },
  NC4:  { label: 'NC (Code 4)',  variant: 'badge--nc',      dot: 'red'   },
  FR:   { label: 'For Record',   variant: 'badge--fr',      dot: 'gray'  },
  FA:   { label: 'For Action',   variant: 'badge--fa',      dot: 'blue'  },
  W:    { label: 'Waiver',       variant: 'badge--waiver',  dot: 'amber' },
} as const

export type RequestStatusKey = keyof typeof REQUEST_STATUS

// ─── Review Code Map ───────────────────────────────────────────────
export const REVIEW_CODE = {
  CODE_1: { code: '1', label: 'Accepted',        color: theme.colors.semantic.success.DEFAULT },
  CODE_2: { code: '2', label: 'Rework Required', color: theme.colors.semantic.warning.DEFAULT },
  CODE_3: { code: '3', label: 'Non-Compliant',   color: theme.colors.semantic.danger.DEFAULT  },
  CODE_4: { code: '4', label: 'Non-Compliant',   color: theme.colors.semantic.danger.DEFAULT  },
  CODE_W: { code: 'W', label: 'Waiver',          color: theme.colors.brand.gold[500]          },
} as const

export default theme