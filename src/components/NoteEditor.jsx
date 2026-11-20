import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { getSchema } from '@tiptap/core';
import { Selection } from '@tiptap/pm/state';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import CharacterCount from '@tiptap/extension-character-count';
import { Check, AlertTriangle } from 'lucide-react';

import { schemaExtensions } from '../lib/extensions.js';
import { SearchReplace } from '../lib/searchReplace.js';
import { SlashCommand } from '../lib/slashCommand.js';
import { exportCurrent, download } from '../lib/io.js';
import { on } from '../lib/bus.js';
import { getContent, saveNote } from '../db/db.js';
import { fontStack, noteFont, noteSize } from '../lib/fonts.js';
import FindBar from './FindBar.jsx';
import { useToast } from '../hooks/useToast.jsx';

const schema = getSchema(schemaExtensions);
const SAVE_DELAY = 600; // save after this much quiet...
const SAVE_MAX_WAIT = 3000; // ...but never leave unsaved work longer than this, even while typing

/** Loads the body from IndexedDB, validates it, then mounts the editor. */
export default function NoteHost({ note, onEditor }) {
  const [state, setState] = useState({ phase: 'loading' });

  useEffect(() => {
    let alive = true;
    getContent(note.id).then((c) => {
      if (!alive) return;
      if (!c) { setState({ phase: 'ready', json: { type: 'doc', content: [{ type: 'paragraph' }] } }); return; }
      try {
        schema.nodeFromJSON(c.json).check();
        setState({ phase: 'ready', json: c.json });
      } catch {
        // Never mount the editor on a broken body: the next autosave would overwrite the raw data.
        setState({ phase: 'broken', raw: c.json });
      }
    }).catch(() => alive && setState({ phase: 'broken', raw: null }));
    return () => { alive = false; };
  }, [note.id]);

  if (state.phase === 'loading') return <div className="editor-loading" aria-busy="true" />;

  if (state.phase === 'broken') {
    return (
      <div className="empty">
        <AlertTriangle size={28} />
        <h2>This note could not be opened</h2>
        <p>Its data looks damaged. Nothing was changed. You can save the raw data to a file.</p>
        <button className="btn" onClick={() => download(`note-${note.id}.json`, JSON.stringify(state.raw ?? null), 'application/json')}>
          Save raw data
        </button>
      </div>
    );
  }

  return <NoteEditor note={note} initial={state.json} onEditor={onEditor} />;
}

function NoteEditor({ note, initial, onEditor }) {
  const toast = useToast();
  const [title, setTitle] = useState(note.title);
  const [status, setStatus] = useState('saved'); // saved | saving | error
  const [findOpen, setFindOpen] = useState(false);
  const [findSeed, setFindSeed] = useState('');
  const titleRef = useRef(note.title);
  const dirty = useRef(false);
  const timer = useRef(null);
  const dirtySince = useRef(0);
  const editorRef = useRef(null);
  const readOnly = !!note.deletedAt; // notes in the trash can be read, not edited

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    timer.current = null;
    dirtySince.current = 0;
    const ed = editorRef.current;
    if (!dirty.current || !ed || ed.isDestroyed) return;
    dirty.current = false;
    try {
      await saveNote(note.id, {
        title: titleRef.current,
        json: ed.getJSON(),
        text: ed.getText({ blockSeparator: ' ' }),
      });
      if (!dirty.current) setStatus('saved');
    } catch (err) {
      dirty.current = true;
      setStatus('error');
      console.error('Save failed', err);
    }
  }, [note.id]);

  const schedule = useCallback(() => {
    dirty.current = true;
    setStatus('saving');
    if (!dirtySince.current) dirtySince.current = Date.now();
    clearTimeout(timer.current);
    const wait = Math.max(0, Math.min(SAVE_DELAY, SAVE_MAX_WAIT - (Date.now() - dirtySince.current)));
    timer.current = setTimeout(flush, wait);
  }, [flush]);

  // Declared before useEditor on purpose: React runs unmount cleanups in order,
  // so this flush still sees a live editor.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [flush]);

  const extensions = useMemo(() => [
    ...schemaExtensions,
    Placeholder.configure({ placeholder: 'Start writing…  type / for headings, lists and more' }),
    CharacterCount,
    Typography,
    SearchReplace,
    SlashCommand,
  ], []);

  const editor = useEditor({
    extensions,
    content: initial,
    autofocus: false,
    editable: !readOnly,
    editorProps: {
      attributes: { 'aria-label': 'Note body', class: 'prose' },
      handleClick: (_view, _pos, event) => {
        if (event.ctrlKey || event.metaKey) {
          const a = event.target instanceof Element ? event.target.closest('a[href]') : null;
          if (a) { window.open(a.href, '_blank', 'noopener,noreferrer'); return true; }
        }
        return false;
      },
    },
    onUpdate: () => schedule(),
  });
  editorRef.current = editor;

  useEffect(() => {
    onEditor?.(editor);
    return () => onEditor?.(null);
  }, [editor, onEditor]);

  useEffect(() => {
    if (editor && editor.isEditable === readOnly) editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  // Commands that come from the top bar, palette and global shortcuts.
  useEffect(() => {
    if (!editor) return undefined;
    const offs = [
      on('find', () => {
        const { from, to, empty } = editor.state.selection;
        const picked = !empty ? editor.state.doc.textBetween(from, to, ' ') : '';
        setFindSeed(picked && picked.length < 80 && !picked.includes('\n') ? picked : '');
        setFindOpen(true);
      }),
      on('export', ({ format }) => {
        if (format === 'pdf') { flush().then(() => window.print()); return; }
        exportCurrent(editor, titleRef.current, format);
        toast(`Exported as .${format}`);
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [editor, flush, toast]);

  // Warn only if a save really failed. Normal edits are flushed on hide.
  useEffect(() => {
    const warn = (e) => { if (dirty.current && status === 'error') { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [status]);

  const stats = useEditorState({
    editor,
    selector: ({ editor: e }) => (e ? { words: e.storage.characterCount.words() } : { words: 0 }),
  });

  // Synchronous on purpose: editor.commands.focus() is deferred, and keys typed right after Enter would land in the title.
  const focusBodyStart = () => {
    if (!editor) return;
    editor.view.dispatch(editor.state.tr.setSelection(Selection.atStart(editor.state.doc)).scrollIntoView());
    editor.view.focus();
  };

  const onTitle = (e) => {
    const v = e.target.value.replace(/\n/g, ' ');
    setTitle(v);
    titleRef.current = v;
    schedule();
  };

  return (
    <div className="editor-shell" style={{ '--editor-font': fontStack(noteFont(note)), '--editor-size': `${noteSize(note)}px` }}>
      {findOpen && editor && (
        <FindBar editor={editor} initialTerm={findSeed} onClose={() => setFindOpen(false)} />
      )}

      <div className="scroll">
        <article className="page">
          <input
            className="title"
            value={title}
            onChange={onTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); focusBodyStart(); }
            }}
            placeholder="Untitled"
            aria-label="Note title"
            maxLength={300}
            autoFocus={!note.title && !readOnly}
            readOnly={readOnly}
          />
          <EditorContent editor={editor} />
        </article>
      </div>

      <footer className="statusbar">
        <span className={`save-state is-${status}`} role="status">
          {status === 'saving' && 'Saving…'}
          {status === 'saved' && (<><Check size={13} /> Saved</>)}
          {status === 'error' && 'Could not save. Storage may be full.'}
        </span>
        <span className="stats">
          {stats.words.toLocaleString()} {stats.words === 1 ? 'word' : 'words'}
        </span>
      </footer>
    </div>
  );
}

