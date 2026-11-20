import { useSyncExternalStore } from 'react';

const KEY = 'nota:settings';

export const DEFAULTS = {
  theme: 'auto', // auto | light | dark
  lastBackupAt: null,
  firstUsedAt: null, // the backup reminder dot only shows 14 days after this
};

const ALLOWED = {
  theme: ['auto', 'light', 'dark'],
};

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    const out = { ...DEFAULTS };
    for (const k of Object.keys(DEFAULTS)) {
      if (!(k in raw)) continue;
      if (ALLOWED[k]) { if (ALLOWED[k].includes(raw[k])) out[k] = raw[k]; }
      else out[k] = typeof raw[k] === 'number' ? raw[k] : null; // lastBackupAt, firstUsedAt
    }
    return out;
  } catch {
    return { ...DEFAULTS };
  }
}

let state = load();
const listeners = new Set();

function apply(s) {
  const r = document.documentElement;
  if (s.theme === 'auto') r.removeAttribute('data-theme');
  else r.setAttribute('data-theme', s.theme);
}
apply(state);

export function updateSettings(patch) {
  state = { ...state, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked: keep working in memory */
  }
  apply(state);
  listeners.forEach((l) => l());
}

const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
export const getSettings = () => state;
export const useSettings = () => useSyncExternalStore(subscribe, getSettings);
