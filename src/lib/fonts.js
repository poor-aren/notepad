// Per-note typography. Notes store only an id / a number; anything else is ignored.
export const FONTS = [
  { id: 'serif', label: 'Serif', stack: 'var(--font-serif)' },
  { id: 'sans', label: 'Sans', stack: 'var(--font-ui)' },
  { id: 'mono', label: 'Mono', stack: 'var(--font-mono)' },
];
export const SIZES = [14, 16, 18, 20, 22, 24, 28, 32];
export const DEFAULT_FONT = 'serif';
export const DEFAULT_SIZE = 18;

export const noteFont = (n) => (FONTS.some((f) => f.id === n?.font) ? n.font : DEFAULT_FONT);
export const noteSize = (n) => (SIZES.includes(n?.fontSize) ? n.fontSize : DEFAULT_SIZE);
export const fontStack = (id) => (FONTS.find((f) => f.id === id) ?? FONTS[0]).stack;
