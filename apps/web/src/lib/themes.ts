/** Shared pane (sidebar + toolbar) color tokens for dark and light modes. */
export const PANE_THEMES = {
  dark: {
    bg:          '#060614',
    sidebar:     '#080c18',
    border:      '#1e293b',
    inputBg:     '#0a0f1e',
    label:       '#334155',
    muted:       '#475569',
    text:        '#94a3b8',
    textPrimary: '#e2e8f0',
    subtext:     '#1e293b',
  },
  light: {
    bg:          '#faf7f2',
    sidebar:     '#f5f0e8',
    border:      '#d4c9b5',
    inputBg:     '#fffdf9',
    label:       '#9ca3af',
    muted:       '#6b7280',
    text:        '#4b5563',
    textPrimary: '#1e293b',
    subtext:     '#c4b89a',
  },
} as const

export type PaneTheme = typeof PANE_THEMES.dark
