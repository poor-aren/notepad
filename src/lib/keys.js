export const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

/** "Mod+K" -> "Ctrl K" or "⌘K", for display only. */
export function kbd(combo) {
  return combo
    .split('+')
    .map((k) => {
      if (k === 'Mod') return isMac ? '⌘' : 'Ctrl';
      if (k === 'Alt') return isMac ? '⌥' : 'Alt';
      if (k === 'Shift') return isMac ? '⇧' : 'Shift';
      return k;
    })
    .join(isMac ? '' : ' + ');
}

export const hasMod = (e) => (isMac ? e.metaKey : e.ctrlKey);
