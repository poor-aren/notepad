import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, FilePlus2, Minimize2, Trash2, Undo2 } from 'lucide-react';

import { db, createNote, trashNote, restoreNote, purgeOldTrash, searchBodies } from './db/db.js';
import { useSettings, updateSettings, getSettings } from './hooks/useSettings.js';
import { useToast } from './hooks/useToast.jsx';
import { pasteFromClipboard } from './lib/editorActions.js';
import { backupAll, importFiles } from './lib/io.js';
import { emit } from './lib/bus.js';
import { hasMod, kbd } from './lib/keys.js';

import Sidebar from './components/Sidebar.jsx';
import TopBar from './components/TopBar.jsx';
import Toolbar from './components/Toolbar.jsx';
import NoteHost from './components/NoteEditor.jsx';
import HelpModal from './components/HelpModal.jsx';

const BASE_TITLE = document.title;
const SEEDED = 'nota:seeded';
const LAST_NOTE = 'nota:lastNote';
const BACKUP_DUE_DAYS = 14;
const readLast = () => { try { return localStorage.getItem(LAST_NOTE); } catch { return null; } };

export default function App() {
  const settings = useSettings();
  const toast = useToast();

  const notes = useLiveQuery(() => db.notes.toArray(), [], null);
  const folders = useLiveQuery(() => db.folders.orderBy('createdAt').toArray(), [], []);

  const [view, setViewState] = useState('all'); // 'all' | 'trash' | { folder }
  const [activeId, setActiveId] = useState(readLast); // reopen where the person left off
  const [search, setSearch] = useState('');
  const [bodyHits, setBodyHits] = useState(() => new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false); // the notes list opens on demand
  const [focusMode, setFocusMode] = useState(false);
  const [help, setHelp] = useState(null); // null | 'shortcuts' | 'about'
  const [editor, setEditor] = useState(null);
  const fileInput = useRef(null);
  const justCreated = useRef(new Set());

  // ---- one-time setup -------------------------------------------------------
  useEffect(() => {
    if (!getSettings().firstUsedAt) updateSettings({ firstUsedAt: Date.now() });
    purgeOldTrash().catch(() => {});
    navigator.storage?.persist?.().catch(() => {}); // ask the browser not to evict our data
  }, []);

  useEffect(() => {
    if (notes === null || notes.length > 0 || localStorage.getItem(SEEDED)) return;
    localStorage.setItem(SEEDED, '1'); // set first: effects can run twice in dev
    createNote().then((id) => { // first visit: one empty page, ready to type
      justCreated.current.add(id);
      setActiveId(id);
    });
  }, [notes]);

  // ---- search over note bodies (debounced) ---------------------------------
  useEffect(() => {
    if (!search.trim()) { setBodyHits(new Set()); return undefined; }
    let alive = true;
    const id = setTimeout(() => searchBodies(search).then((s) => alive && setBodyHits(s)), 150);
    return () => { alive = false; clearTimeout(id); };
  }, [search, notes]);

  // ---- derived lists --------------------------------------------------------
  const all = notes ?? [];
  const counts = useMemo(() => {
    const c = { all: 0, trash: 0, byFolder: {} };
    for (const n of all) {
      if (n.deletedAt) c.trash++;
      else {
        c.all++;
        if (n.folderId) c.byFolder[n.folderId] = (c.byFolder[n.folderId] || 0) + 1;
      }
    }
    return c;
  }, [all]);

  const q = search.trim().toLowerCase();

  const list = useMemo(() => {
    let l;
    if (q) {
      // Search looks everywhere except Trash.
      l = all.filter((n) => !n.deletedAt && ((n.title || '').toLowerCase().includes(q) || (n.snippet || '').toLowerCase().includes(q) || bodyHits.has(n.id)));
    } else {
      l = all.filter((n) => {
        if (view === 'trash') return !!n.deletedAt;
        if (n.deletedAt) return false;
        if (typeof view === 'object') return n.folderId === view.folder;
        return true;
      });
    }
    const key = view === 'trash' && !q ? 'deletedAt' : 'updatedAt';
    return [...l].sort((a, b) => b[key] - a[key]);
  }, [all, view, q, bodyHits]);

  const active = all.find((n) => n.id === activeId) || null;

  // Keep a sensible note open when the current one disappears from the view.
  useEffect(() => {
    if (notes === null) return;
    const cur = notes.find((n) => n.id === activeId);
    if (activeId && !cur) {
      if (justCreated.current.has(activeId)) return; // list has not caught up yet
    } else if (cur) {
      if (cur.deletedAt && justCreated.current.has(activeId)) return; // restore in flight
      justCreated.current.delete(activeId);
      if (list.some((n) => n.id === activeId)) return;
      if (q && !cur.deletedAt) return; // do not yank the note away while searching
    }
    setActiveId(list[0]?.id ?? null);
  }, [notes, list, activeId, q]);

  useEffect(() => {
    try {
      if (activeId) localStorage.setItem(LAST_NOTE, activeId);
    } catch { /* private mode: not critical */ }
  }, [activeId]);

  useEffect(() => {
    // An untitled note keeps the page's own title (the one search engines index).
    document.title = active?.title ? `${active.title} - Nota` : BASE_TITLE;
  }, [active?.title, active?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- actions --------------------------------------------------------------
  const changeView = useCallback((v) => {
    setViewState(v);
    setSearch('');
  }, []);

  const select = useCallback((id) => {
    setActiveId(id);
    setSidebarOpen(false);
  }, []);

  const newNote = useCallback(async () => {
    const folderId = typeof view === 'object' ? view.folder : null;
    const id = await createNote({ folderId });
    justCreated.current.add(id);
    if (view === 'trash') setViewState('all');
    setSearch('');
    setActiveId(id);
    setSidebarOpen(false);
  }, [view]);

  const trashActive = useCallback(async () => {
    if (!active) return;
    const id = active.id;
    await trashNote(id);
    toast('Moved to trash', { action: { label: 'Undo', run: async () => { justCreated.current.add(id); await restoreNote(id); setActiveId(id); } } });
  }, [active, toast]);

  const backup = useCallback(async () => {
    try {
      const n = await backupAll();
      updateSettings({ lastBackupAt: Date.now() });
      toast(`Backup downloaded (${n} ${n === 1 ? 'note' : 'notes'})`);
    } catch (err) {
      toast(`Backup failed: ${err.message || 'unknown error'}`, { tone: 'error' });
    }
  }, [toast]);

  const doImport = useCallback(async (files) => {
    if (!files?.length) return;
    let lastId = null;
    const create = async (data) => { lastId = await createNote(data); return lastId; };
    const s = await importFiles(files, create);
    const parts = [];
    if (s.notes) parts.push(`${s.notes} ${s.notes === 1 ? 'note' : 'notes'} imported`);
    if (s.restored) {
      const r = s.restored;
      parts.push(`backup restored: ${r.added} new, ${r.updated} updated, ${r.skipped} unchanged${r.rejected ? `, ${r.rejected} unreadable` : ''}`);
    }
    if (s.failed.length) parts.push(`could not import ${s.failed.join(', ')}`);
    const message = parts.join('. ') || 'Nothing imported';
    toast(message.charAt(0).toUpperCase() + message.slice(1), { tone: s.failed.length && !parts.length ? 'error' : undefined, duration: 8000 });
    if (lastId) { justCreated.current.add(lastId); setViewState('all'); setActiveId(lastId); }
  }, [toast]);

  const pickFiles = useCallback(() => fileInput.current?.click(), []);

  const paste = useCallback(() => {
    if (!editor) return;
    pasteFromClipboard(editor).catch(() => toast(`Paste was blocked by the browser. Press ${kbd('Mod+V')} instead.`, { tone: 'error' }));
  }, [editor, toast]);

  // ---- global shortcuts (handler kept in a ref so it never goes stale) -----
  const keyHandler = useRef(null);
  keyHandler.current = (e) => {
    const mod = hasMod(e);
    const k = e.key.toLowerCase();
    const editable = active && !active.deletedAt;
    if (mod && e.key === '\\') { e.preventDefault(); setSidebarOpen((o) => !o); }
    else if (mod && e.shiftKey && k === 'f') { e.preventDefault(); setFocusMode((f) => !f); }
    else if (mod && !e.shiftKey && !e.altKey && k === 'f') { if (editable) { e.preventDefault(); emit('find'); } }
    else if (e.altKey && !mod && e.code === 'KeyN') { e.preventDefault(); newNote(); }
    else if (e.key === 'Escape' && !help) {
      if (focusMode) setFocusMode(false);
      else if (sidebarOpen) setSidebarOpen(false);
    }
  };
  useEffect(() => {
    const h = (e) => keyHandler.current(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const backupDue = counts.all > 0 &&
    Date.now() - (settings.lastBackupAt ?? settings.firstUsedAt ?? Date.now()) > BACKUP_DUE_DAYS * 86400000;

  if (notes === null) return <div className="boot" aria-busy="true" />;

  return (
    <div className={`app ${focusMode ? 'is-focus' : ''}`}>
      {sidebarOpen && !focusMode && <div className="backdrop" onClick={() => setSidebarOpen(false)} aria-hidden="true" />}

      <div className={`sidebar-slot ${sidebarOpen && !focusMode ? 'is-open' : ''}`} inert={!sidebarOpen || focusMode}>
        <Sidebar
          counts={counts}
          folders={folders}
          view={view}
          setView={changeView}
          list={list}
          activeId={activeId}
          onSelect={select}
          onNew={newNote}
          search={search}
          setSearch={setSearch}
          onClose={() => setSidebarOpen(false)}
          toast={toast}
        />
      </div>

      <main className="main">
        {focusMode ? (
          <button className="icon-btn focus-exit" onClick={() => setFocusMode(false)} aria-label="Exit focus mode" title="Exit focus mode (Esc)">
            <Minimize2 size={18} />
          </button>
        ) : (
          <>
            <TopBar
              note={active}
              folders={folders}
              editor={editor}
              onToggleSidebar={() => setSidebarOpen((o) => !o)}
              onToggleFocus={() => setFocusMode(true)}
              onNew={newNote}
              onOpen={pickFiles}
              onBackup={backup}
              onTrash={trashActive}
              onPaste={paste}
              onHelp={setHelp}
              theme={settings.theme}
              onTheme={(theme) => updateSettings({ theme })}
              backupDue={backupDue}
            />
            <Toolbar editor={editor} note={active} onNew={newNote} onOpen={pickFiles} onPaste={paste} onToggleFocus={() => setFocusMode(true)} />
            {active?.deletedAt && (
              <div className="trash-banner" role="status">
                <Trash2 size={14} /> This note is in the trash.
                <button className="link-btn" onClick={() => restoreNote(active.id)}><Undo2 size={13} /> Restore</button>
              </div>
            )}
          </>
        )}
        {active ? (
          <NoteHost key={active.id} note={active} onEditor={setEditor} />
        ) : (
          <div className="empty">
            <FilePlus2 size={32} />
            <h2>{list.length ? 'Pick a note to start' : q ? 'No notes match' : view === 'trash' ? 'Trash is empty' : 'Nothing here yet'}</h2>
            <p>{list.length ? 'Open the notes list, or start a fresh page.' : view === 'trash' ? 'Deleted notes show up here for 30 days.' : 'Start a fresh page whenever you are ready.'}</p>
            <button className="btn primary" onClick={newNote}><Plus size={16} /> New note</button>
          </div>
        )}
      </main>

      {help && <HelpModal kind={help} onClose={() => setHelp(null)} />}

      <input
        ref={fileInput}
        type="file"
        hidden
        multiple
        accept=".json,.md,.markdown,.txt,application/json,text/plain,text/markdown"
        onChange={(e) => { doImport(e.target.files); e.target.value = ''; }}
      />
    </div>
  );
}
