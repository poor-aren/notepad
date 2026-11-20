// Tiny event bus so far-apart components (palette, top bar, editor) can talk
// without prop drilling or a global store.
const target = new EventTarget();

export const emit = (name, detail) => target.dispatchEvent(new CustomEvent(name, { detail }));

export const on = (name, handler) => {
  const fn = (e) => handler(e.detail);
  target.addEventListener(name, fn);
  return () => target.removeEventListener(name, fn);
};
