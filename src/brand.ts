/**
 * The ONE place for the product name, tagline and colors.
 * - Names: change BRAND and every page, the document title and the logo follow.
 * - Colors: both palettes live here. `applyTheme()` writes them to CSS variables; the fallback values
 *   in src/index.css mirror THEMES.dark (a regression test fails if they drift).
 * Contrast of every text/background pair below is verified by a test (WCAG AA, 4.5:1).
 */
export const BRAND = {
  name: 'Armora',
  tagline: 'Agent action firewall',
  thesis: 'Reading untrusted content should never authorize a sensitive action.',
  /** shown wherever the data is not real */
  demoBadge: 'Demo environment, synthetic data',
  organization: 'Acme CyberSec Corp (demo)',
  repoUrl: 'https://github.com/divu1249/Armora',
} as const;

export type ThemeName = 'dark' | 'light';

export interface Palette {
  canvas: string;
  surface: string;
  subtle: string;
  raised: string;
  line: string;
  lineStrong: string;
  fg: string;
  fg2: string;
  muted: string;
  /** decorative only (borders, disabled): not used for text that must be read */
  faint: string;
  accent: string;
  ok: string;
  warn: string;
  danger: string;
  info: string;
  /** solid fills: white text on these passes AA in both themes */
  accentSolid: string;
  okSolid: string;
  warnSolid: string;
  dangerSolid: string;
  infoSolid: string;
  onSolid: string;
  /** code blocks are dark in both themes */
  code: string;
  codeFg: string;
  codeMuted: string;
  focus: string;
}

const solids = {
  accentSolid: '#4f46e5',
  okSolid: '#15803d',
  warnSolid: '#b45309',
  dangerSolid: '#dc2626',
  infoSolid: '#7c3aed',
  onSolid: '#ffffff',
  code: '#0a0c10',
  codeFg: '#d6dce8',
  codeMuted: '#8d97a8',
};

export const THEMES: Record<ThemeName, Palette> = {
  dark: {
    canvas: '#0b0d12',
    surface: '#11141b',
    subtle: '#171b24',
    raised: '#1d222d',
    line: '#262c38',
    lineStrong: '#353d4c',
    fg: '#e8ecf3',
    fg2: '#b6bfce',
    muted: '#8d97a8',
    faint: '#6b7586',
    accent: '#a5b4fc',
    ok: '#4ade80',
    warn: '#fbbf24',
    danger: '#f87171',
    info: '#c4b5fd',
    focus: '#a5b4fc',
    ...solids,
  },
  light: {
    canvas: '#f6f7f9',
    surface: '#ffffff',
    subtle: '#f1f3f6',
    raised: '#e8ebf0',
    line: '#dfe3ea',
    lineStrong: '#c5ccd8',
    fg: '#11141b',
    fg2: '#3d4656',
    muted: '#5b6578',
    faint: '#8791a3',
    accent: '#4338ca',
    ok: '#166534',
    warn: '#92400e',
    danger: '#b91c1c',
    info: '#6d28d9',
    focus: '#4338ca',
    ...solids,
  },
};

/** CSS variable name for a palette key: lineStrong -> --c-line-strong */
export const cssVar = (key: keyof Palette): string => `--c-${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`;

export const THEME_STORAGE_KEY = 'armora.theme';

export function applyTheme(theme: ThemeName, root: HTMLElement = document.documentElement): void {
  const palette = THEMES[theme];
  for (const key of Object.keys(palette) as Array<keyof Palette>) root.style.setProperty(cssVar(key), palette[key]);
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

export function initialTheme(): ThemeName {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light';
  } catch {
    /* storage unavailable */
  }
  return 'dark';
}

/** Design tokens other than color. The 8px grid: use multiples of SPACE.unit in layout. */
export const TOKENS = {
  space: { unit: 8, steps: [0, 4, 8, 16, 24, 32, 48, 64] },
  radius: { sm: 4, md: 8, lg: 12, full: 9999 },
  elevation: {
    1: '0 1px 2px rgba(0,0,0,0.16)',
    2: '0 4px 12px rgba(0,0,0,0.18)',
    3: '0 12px 32px rgba(0,0,0,0.28)',
  },
  motionMs: 150,
} as const;
