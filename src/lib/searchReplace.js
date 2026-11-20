import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const searchKey = new PluginKey('nota-search');

const INLINE_LEAF = '￼';

/** Find matches inside each text block so marks (bold, links...) never split a match. */
function findMatches(doc, term, caseSensitive) {
  const out = [];
  if (!term) return out;
  const needle = caseSensitive ? term : term.toLowerCase();

  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let text = '';
    const segs = [];
    node.forEach((child, offset) => {
      segs.push({ start: text.length, pos: pos + 1 + offset });
      text += child.isText ? child.text : INLINE_LEAF;
    });
    const hay = caseSensitive ? text : text.toLowerCase();
    const toPos = (idx) => {
      let seg = segs[0];
      for (const s of segs) if (s.start <= idx) seg = s;
      return seg.pos + (idx - seg.start);
    };
    let i = hay.indexOf(needle);
    while (i !== -1) {
      out.push({ from: toPos(i), to: toPos(i + needle.length - 1) + 1 });
      i = hay.indexOf(needle, i + needle.length);
    }
    return false; // do not descend into the text block
  });
  return out;
}

const initial = { term: '', caseSensitive: false, matches: [], current: 0, active: false };

function build(doc, prev, patch) {
  const next = { ...prev, ...patch };
  next.matches = next.active ? findMatches(doc, next.term, next.caseSensitive) : [];
  if (next.current >= next.matches.length) next.current = 0;
  return next;
}

export const SearchReplace = Extension.create({
  name: 'searchReplace',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: searchKey,
        state: {
          init: () => initial,
          apply(tr, prev) {
            const meta = tr.getMeta(searchKey);
            if (meta) return build(tr.doc, prev, meta);
            if (tr.docChanged && prev.active) return build(tr.doc, prev, {});
            return prev;
          },
        },
        props: {
          decorations(state) {
            const s = searchKey.getState(state);
            if (!s.active || !s.matches.length) return DecorationSet.empty;
            return DecorationSet.create(
              state.doc,
              s.matches.map((m, i) =>
                Decoration.inline(m.from, m.to, {
                  class: i === s.current ? 'search-match search-match-current' : 'search-match',
                }),
              ),
            );
          },
        },
      }),
    ];
  },

  addCommands() {
    const dispatchMeta = (meta) => ({ tr, dispatch }) => {
      if (dispatch) dispatch(tr.setMeta(searchKey, meta));
      return true;
    };
    return {
      setSearch: (term, caseSensitive = false) => dispatchMeta({ term, caseSensitive, active: true, current: 0 }),
      closeSearch: () => dispatchMeta({ term: '', active: false, current: 0 }),
      nextMatch: () => ({ state, tr, dispatch }) => {
        const s = searchKey.getState(state);
        if (!s.matches.length) return false;
        dispatch?.(tr.setMeta(searchKey, { current: (s.current + 1) % s.matches.length }));
        return true;
      },
      prevMatch: () => ({ state, tr, dispatch }) => {
        const s = searchKey.getState(state);
        if (!s.matches.length) return false;
        dispatch?.(tr.setMeta(searchKey, { current: (s.current - 1 + s.matches.length) % s.matches.length }));
        return true;
      },
      replaceCurrent: (text) => ({ state, tr, dispatch }) => {
        const s = searchKey.getState(state);
        const m = s.matches[s.current];
        if (!m) return false;
        dispatch?.(tr.insertText(text, m.from, m.to));
        return true;
      },
      replaceAll: (text) => ({ state, tr, dispatch }) => {
        const s = searchKey.getState(state);
        if (!s.matches.length) return false;
        // Go backwards so earlier positions stay valid while we edit.
        for (const m of [...s.matches].reverse()) tr.insertText(text, m.from, m.to);
        dispatch?.(tr);
        return true;
      },
    };
  },
});
