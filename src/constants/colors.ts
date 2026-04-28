export const colors = {
  // Backgrounds — warm dark brown with enough luminance to read on OLED/P3 displays
  background:     '#1e1608',
  surface:        '#3c3018',
  surfaceRaised:  '#4e4228',
  surfaceSunken:  '#141006',   // carved-stone section headers

  // Borders
  border:         '#5c4a28',
  borderSubtle:   '#3a2e14',

  // Bevel — lighter top/left, darker bottom/right for the raised panel look
  bevelLight:     '#a08060',
  bevelDark:      '#1a1208',

  // Gold — the classic OSRS accent, used sparingly
  gold:           '#D4AF37',
  goldDark:       '#b8960f',

  // Text — warm cream/parchment
  textPrimary:    '#ffe8b0',
  textSecondary:  '#a89060',
  textMuted:      '#7a6540',
  textDisabled:   '#5a4830',

  // Status
  success:        '#4a6e3a',
  successText:    '#d4ffb0',
  successLight:   '#4a8a2a',   // bevel light for green panels
  successDark:    '#0d1a08',   // bevel dark for green panels
  successSurface: '#1e3d0f',   // background of green panels

  error:          '#ff6b6b',
  errorDark:      '#ff5252',
  errorText:      '#ff9999',

  destructive:        '#8B1A1A',
  destructiveDark:    '#6b1010',
  destructiveDisabled:'#5a1010',
};

// Spread these into StyleSheet objects for the raised/inset bevel effect
export const bevel = {
  raised: {
    borderWidth: 2,
    borderTopColor: colors.bevelLight,
    borderLeftColor: colors.bevelLight,
    borderBottomColor: colors.bevelDark,
    borderRightColor: colors.bevelDark,
  },
  inset: {
    borderWidth: 2,
    borderTopColor: colors.bevelDark,
    borderLeftColor: colors.bevelDark,
    borderBottomColor: colors.bevelLight,
    borderRightColor: colors.bevelLight,
  },
  green: {
    borderWidth: 2,
    borderTopColor: colors.successLight,
    borderLeftColor: colors.successLight,
    borderBottomColor: colors.successDark,
    borderRightColor: colors.successDark,
  },
};
