// Editor commands shared by the menu bar and the toolbar.

/** Accept "example.com", "/path", "#id", "mailto:x@y.z" and full URLs. */
export function normalizeUrl(raw) {
  const v = raw.trim();
  if (!v) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(v) || v.startsWith('/') || v.startsWith('#')) return v;
  return `https://${v}`;
}

// view.focus() is synchronous and re-syncs the DOM selection from the editor state,
// so cut/copy still see the selection after a menu or button took focus.
export function cutSelection(editor) {
  editor.view.focus();
  document.execCommand('cut');
}

export function copySelection(editor) {
  editor.view.focus();
  document.execCommand('copy');
}

/** Paste from the system clipboard. Throws when the browser blocks or lacks clipboard reads. */
export async function pasteFromClipboard(editor) {
  const { clipboard } = navigator;
  if (!clipboard) throw new Error('clipboard unavailable');
  editor.view.focus();
  if (clipboard.read) {
    for (const item of await clipboard.read()) {
      if (item.types.includes('text/html')) {
        editor.view.pasteHTML(await (await item.getType('text/html')).text());
        return;
      }
      if (item.types.includes('text/plain')) {
        editor.view.pasteText(await (await item.getType('text/plain')).text());
        return;
      }
    }
    return;
  }
  if (clipboard.readText) { editor.view.pasteText(await clipboard.readText()); return; }
  throw new Error('clipboard unavailable');
}
