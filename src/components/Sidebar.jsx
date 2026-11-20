import { useRef, useState } from 'react';
import {
  Plus, Search, Pin, Trash2, Folder, FolderPlus, FileText, MoreHorizontal,
  PanelLeftClose, Pencil, X, ChevronUp, ChevronDown, ArrowLeft,
} from 'lucide-react';
import Menu from './Menu.jsx';
import { timeAgo } from '../lib/format.js';
import { kbd } from '../lib/keys.js';
import { createFolder, deleteFolder, renameFolder, emptyTrash, restoreNote, deleteForever } from '../db/db.js';

export default function Sidebar({
  counts, folders, view, setView, list, activeId, onSelect, onNew, search, setSearch, onClose, toast,
}) {
  const [more, setMore] = useState(false);
  const [addingFolder, setAddingFolder] = useState(false);
  const [renaming, setRenaming] = useState(null);

  const viewKey = typeof view === 'string' ? view : `folder:${view.folder}`;
  const isActive = (v) => viewKey === (typeof v === 'string' ? v : `folder:${v.folder}`);

  const pinned = list.filter((n) => n.pinned);
  const rest = list.filter((n) => !n.pinned);

  // Which "place" the list is showing, when it is not the default.
  const folderName = typeof view === 'object' ? folders.find((f) => f.id === view.folder)?.name : null;
  const scopeLabel = view === 'trash' ? 'Trash' : folderName;
  const showScope = !search && view !== 'all' && scopeLabel;

  const noteRow = (n) => (
    <li key={n.id}>
      <button
        className={`note-row ${n.id === activeId ? 'is-active' : ''}`}
        onClick={() => onSelect(n.id)}
        aria-current={n.id === activeId ? 'true' : undefined}
      >
        <span className="note-title">{n.title || 'Untitled'}</span>
        <span className="note-snippet">{n.snippet || 'Empty note'}</span>
        <span className="note-meta">
          {n.pinned && <Pin size={11} aria-label="Pinned" />}
          {timeAgo(n.deletedAt || n.updatedAt)}
        </span>
      </button>
    </li>
  );

  const nav = (key, label, Icon, count) => (
    <button className={`nav-item ${isActive(key) ? 'is-active' : ''}`} onClick={() => setView(key)}>
      <Icon size={16} />
      <span className="nav-label">{label}</span>
      {count > 0 && <span className="nav-count">{count}</span>}
    </button>
  );

  return (
    <aside className="sidebar" aria-label="Notes">
      <div className="sidebar-head">
        <div className="brand"><span className="brand-mark" aria-hidden="true" />Nota</div>
        <button className="icon-btn" onClick={onClose} aria-label="Hide sidebar" title={`Hide sidebar (${kbd('Mod+\\')})`}>
          <PanelLeftClose size={18} />
        </button>
      </div>

      <button className="btn primary block" onClick={onNew}>
        <Plus size={16} /> New note
      </button>

      <div className="search">
        <Search size={15} aria-hidden="true" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') setSearch(''); }}
          placeholder="Search notes"
          aria-label="Search notes"
        />
        {search && (
          <button className="icon-btn xs" onClick={() => setSearch('')} aria-label="Clear search"><X size={14} /></button>
        )}
      </div>

      {showScope && (
        <div className="scope">
          <button className="link-btn" onClick={() => setView('all')}>
            <ArrowLeft size={13} /> All notes
          </button>
          <span className="scope-name">{scopeLabel}</span>
          {view === 'trash' && counts.trash > 0 && (
            <button
              className="link-btn danger"
              onClick={async () => {
                if (window.confirm(`Permanently delete ${counts.trash} ${counts.trash === 1 ? 'note' : 'notes'}? This cannot be undone.`)) {
                  await emptyTrash();
                  toast('Trash emptied');
                }
              }}
            >
              Empty
            </button>
          )}
        </div>
      )}

      <div className="note-list" role="region" aria-label="Note list">
        {view === 'trash' && !search && <p className="hint">Notes here are deleted for good after 30 days.</p>}
        {!list.length && (
          <p className="hint">
            {search ? 'No notes match.' : view === 'trash' ? 'Trash is empty.' : 'No notes yet.'}
          </p>
        )}
        {pinned.length > 0 && (
          <>
            <div className="list-label">Pinned</div>
            <ul>{pinned.map(noteRow)}</ul>
            {rest.length > 0 && <div className="list-label">Others</div>}
          </>
        )}
        <ul>{rest.map(noteRow)}</ul>
      </div>

      {view === 'trash' && activeId && list.some((n) => n.id === activeId) && (
        <div className="trash-actions">
          <button className="btn sm" onClick={() => restoreNote(activeId)}>Restore</button>
          <button
            className="btn sm danger"
            onClick={() => {
              if (window.confirm('Delete this note forever? This cannot be undone.')) deleteForever(activeId);
            }}
          >
            Delete forever
          </button>
        </div>
      )}

      <div className="more">
        {more && (
          <div className="more-panel">
            <nav className="nav" aria-label="Views">
              {nav('all', 'All notes', FileText, counts.all)}
              {nav('trash', 'Trash', Trash2, counts.trash)}
            </nav>

            <div className="section-head">
              <span>Folders</span>
              <button className="icon-btn xs" onClick={() => setAddingFolder(true)} aria-label="New folder" title="New folder"><FolderPlus size={14} /></button>
            </div>
            <div className="folders">
              {addingFolder && (
                <InlineInput
                  placeholder="Folder name"
                  onDone={async (v) => {
                    setAddingFolder(false);
                    if (!v) return;
                    const id = await createFolder(v);
                    if (id) setView({ folder: id });
                  }}
                />
              )}
              {folders.map((f) =>
                renaming === f.id ? (
                  <InlineInput key={f.id} initial={f.name} onDone={(v) => { setRenaming(null); if (v) renameFolder(f.id, v); }} />
                ) : (
                  <div key={f.id} className={`nav-item folder ${isActive({ folder: f.id }) ? 'is-active' : ''}`}>
                    <button className="folder-btn" onClick={() => setView({ folder: f.id })}>
                      <Folder size={16} />
                      <span className="nav-label">{f.name}</span>
                      {counts.byFolder[f.id] > 0 && <span className="nav-count">{counts.byFolder[f.id]}</span>}
                    </button>
                    <Menu
                      icon={MoreHorizontal}
                      label={`Folder options for ${f.name}`}
                      className="folder-menu"
                      align="left"
                      items={[
                        { label: 'Rename', icon: Pencil, onClick: () => setRenaming(f.id) },
                        {
                          label: 'Delete folder', icon: Trash2, danger: true,
                          onClick: async () => {
                            await deleteFolder(f.id);
                            if (view.folder === f.id) setView('all');
                            toast('Folder deleted. Its notes are still in All notes.');
                          },
                        },
                      ]}
                    />
                  </div>
                ),
              )}
              {!folders.length && !addingFolder && <p className="hint">No folders yet.</p>}
            </div>

          </div>
        )}

        <button className="more-toggle" onClick={() => setMore((m) => !m)} aria-expanded={more}>
          <span>More</span>
          {more ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>
    </aside>
  );
}

function InlineInput({ initial = '', placeholder, onDone }) {
  const [v, setV] = useState(initial);
  const finished = useRef(false); // onDone must fire exactly once (blur can follow Enter/Escape)
  const finish = (value) => {
    if (finished.current) return;
    finished.current = true;
    onDone(value);
  };
  return (
    <input
      className="inline-input"
      autoFocus
      value={v}
      maxLength={60}
      placeholder={placeholder}
      aria-label={placeholder || 'Folder name'}
      onChange={(e) => setV(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={() => finish(v.trim())}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(v.trim());
        if (e.key === 'Escape') finish('');
      }}
    />
  );
}
