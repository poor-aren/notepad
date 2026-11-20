import { useEffect, useRef, useState } from 'react';
import { useEditorState } from '@tiptap/react';
import { ChevronUp, ChevronDown, X, CaseSensitive } from 'lucide-react';
import { searchKey } from '../lib/searchReplace.js';

export default function FindBar({ editor, initialTerm, onClose }) {
  const [term, setTerm] = useState(initialTerm || '');
  const [replacement, setReplacement] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const inputRef = useRef(null);

  const search = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const s = searchKey.getState(e.state);
      return { count: s.matches.length, current: s.current };
    },
  });

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    editor.commands.setSearch(term, caseSensitive);
  }, [editor, term, caseSensitive]);

  useEffect(() => () => { if (!editor.isDestroyed) editor.commands.closeSearch(); }, [editor]);

  // Keep the current match visible.
  useEffect(() => {
    if (!search.count) return;
    const id = requestAnimationFrame(() => {
      editor.view.dom.querySelector('.search-match-current')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(id);
  }, [editor, search.current, search.count, term]);

  // view.focus() is synchronous. commands.focus() is deferred and could steal focus from a dialog opened right after.
  const close = () => { onClose(); editor.view.focus(); };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? editor.commands.prevMatch() : editor.commands.nextMatch(); }
  };

  // Escape closes the bar wherever focus is (a button that just became disabled drops focus to the page).
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const onEsc = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      closeRef.current();
    };
    document.addEventListener('keydown', onEsc, true);
    return () => document.removeEventListener('keydown', onEsc, true);
  }, []);

  const replaceCurrent = () => { editor.commands.replaceCurrent(replacement); inputRef.current?.focus(); };
  const replaceAll = () => { editor.commands.replaceAll(replacement); inputRef.current?.focus(); };

  return (
    <div className="findbar" role="search" aria-label="Find and replace">
      <div className="findbar-row">
        <input
          ref={inputRef}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Find in note"
          aria-label="Find in note"
          spellCheck={false}
        />
        <span className="findbar-count" aria-live="polite">
          {term ? (search.count ? `${search.current + 1} of ${search.count}` : 'No results') : ''}
        </span>
        <button className={`icon-btn sm ${caseSensitive ? 'is-active' : ''}`} onClick={() => setCaseSensitive((v) => !v)}
          aria-pressed={caseSensitive} aria-label="Match case" title="Match case"><CaseSensitive size={16} /></button>
        <button className="icon-btn sm" onClick={() => editor.commands.prevMatch()} disabled={!search.count} aria-label="Previous match" title="Previous (Shift+Enter)"><ChevronUp size={16} /></button>
        <button className="icon-btn sm" onClick={() => editor.commands.nextMatch()} disabled={!search.count} aria-label="Next match" title="Next (Enter)"><ChevronDown size={16} /></button>
        <button className="icon-btn sm" onClick={close} aria-label="Close find" title="Close (Esc)"><X size={16} /></button>
      </div>
      <div className="findbar-row">
        <input
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); replaceCurrent(); } }}
          placeholder="Replace with"
          aria-label="Replace with"
          spellCheck={false}
        />
        <button className="btn sm" disabled={!search.count} onClick={replaceCurrent}>Replace</button>
        <button className="btn sm" disabled={!search.count} onClick={replaceAll}>Replace all</button>
      </div>
    </div>
  );
}
