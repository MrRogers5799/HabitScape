/**
 * UI kit tokens for the new version of HabitScape (vault PROD-024). The live app keeps
 * src/constants/colors.ts and typography.ts untouched; only new-version screens use these.
 */

/** Spacing scale in dp. Screens use `gutter` at the sides and `gap` between panels. */
export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  gutter: 14,
  gap: 14,
} as const;

export const kitColors = {
  background: '#140e07',
  panelFill: '#2a2010', // matches the flat centre of the panel frame
  slotFill: '#1a140a', // matches the flat centre of the slot frame
  text: '#f6e6bd',
  textMuted: '#bfa575',
  textFaint: '#a08860', // 4.7:1 on panels (was #86704a, 3.4:1; UI review 2026-11-21)
  gold: '#efc85a',
  goldDeep: '#8b5a2b',
  green: '#93d46b',
  greenDeep: '#2f5a1c',
  red: '#ff8a7a',
  divider: '#5a4422',
  barTrack: '#0f0b05',
  onButton: '#2a1608',
} as const;

/**
 * Pixelify Sans for headings, labels and buttons; VT323 for running text and numbers,
 * because Pixelify's small digits blur together on phones (a 5 or 2 reads as an 8).
 */
export const kitFonts = {
  regular: 'PixelifySans',
  bold: 'PixelifySansBold',
  text: 'VT323',
} as const;

/** Type sizes. Every new-version text style comes from here. */
export const type = {
  title: { fontFamily: kitFonts.bold, fontSize: 24, lineHeight: 30, color: kitColors.gold },
  heading: { fontFamily: kitFonts.bold, fontSize: 18, lineHeight: 23, color: kitColors.gold },
  body: { fontFamily: kitFonts.text, fontSize: 21, lineHeight: 23, color: kitColors.text },
  bodyBold: { fontFamily: kitFonts.regular, fontSize: 18, lineHeight: 23, color: kitColors.text },
  caption: { fontFamily: kitFonts.text, fontSize: 19, lineHeight: 21, color: kitColors.textMuted },
  /** Any number shown on its own: counts, times, levels. */
  number: { fontFamily: kitFonts.text, fontSize: 24, lineHeight: 26, color: kitColors.gold },
  readout: { fontFamily: kitFonts.text, fontSize: 46, lineHeight: 48, color: kitColors.green },
  button: { fontFamily: kitFonts.regular, fontSize: 20, lineHeight: 24, color: kitColors.onButton },
} as const;
