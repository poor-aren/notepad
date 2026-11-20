import {
  PanelLeft, MoreHorizontal, FilePlus, FolderOpen, FileCode, FileText, Printer, Pin, PinOff, FolderInput,
  Trash2, Download, Undo2, Redo2, Scissors, Copy, ClipboardPaste, TextSelect, Search, Link2, Maximize2,
  Keyboard, Info, Heading1, Heading2, ListTodo, List, ListOrdered, Quote, Code, Minus,
} from 'lucide-react';

const BLOCK_ICONS = {
  'Heading 1': Heading1, 'Heading 2': Heading2, 'To-do list': ListTodo, 'Bullet list': List,
  'Numbered list': ListOrdered, Quote, 'Code block': Code, Divider: Minus,
};
import Menu from './Menu.jsx';
import MenuBar from './MenuBar.jsx';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { SLASH_ITEMS } from '../lib/slashCommand.js';
import { cutSelection, copySelection } from '../lib/editorActions.js';
import { emit } from '../lib/bus.js';
import { kbd } from '../lib/keys.js';
import { patchNote } from '../db/db.js';

/** App bar: notes button, brand and the File / Edit / Insert / View / Help menus (one button on phones). */
export default function TopBar({
  note, folders, editor, onToggleSidebar, onToggleFocus, onNew, onOpen, onBackup, onTrash, onPaste, onHelp,
  theme, onTheme, backupDue,
}) {
  const mobile = useIsMobile();
  const hasNote = !!note && !note.deletedAt;
  const ed = hasNote ? editor : null; // trashed notes are read-only: no editing, no export
  const canEdit = !!ed && ed.isEditable;
  // view.focus() is synchronous: chain().focus() alone is deferred, and keys typed right after a menu click would miss the editor.
  const chain = () => { ed.view.focus(); return ed.chain().focus(); };

  const file = [
    { label: 'New note', icon: FilePlus, hint: kbd('Alt+N'), onClick: onNew },
    { label: 'Open files…', icon: FolderOpen, onClick: onOpen },
    { sep: true },
    { label: 'Save as Markdown (.md)', icon: FileCode, disabled: !ed, onClick: () => emit('export', { format: 'md' }) },
    { label: 'Save as text (.txt)', icon: FileText, disabled: !ed, onClick: () => emit('export', { format: 'txt' }) },
    { label: 'Print / save as PDF', icon: Printer, disabled: !ed, onClick: () => emit('export', { format: 'pdf' }) },
    { sep: true },
    { label: note?.pinned ? 'Unpin' : 'Pin to top', icon: note?.pinned ? PinOff : Pin, disabled: !hasNote, onClick: () => patchNote(note.id, { pinned: !note.pinned }) },
    ...(hasNote && folders.length ? [
      { heading: 'Move to folder' },
      { label: 'No folder', icon: FolderInput, checked: !note.folderId, onClick: () => patchNote(note.id, { folderId: null }) },
      ...folders.map((f) => ({ label: f.name, icon: FolderInput, checked: note.folderId === f.id, onClick: () => patchNote(note.id, { folderId: f.id }) })),
    ] : []),
    { label: 'Move to trash', icon: Trash2, danger: true, disabled: !hasNote, onClick: onTrash },
    { sep: true },
    { label: 'Download backup', icon: Download, onClick: onBackup },
  ];

  const edit = [
    { label: 'Undo', icon: Undo2, hint: kbd('Mod+Z'), disabled: !canEdit, onClick: () => chain().undo().run() },
    { label: 'Redo', icon: Redo2, hint: kbd('Mod+Shift+Z'), disabled: !canEdit, onClick: () => chain().redo().run() },
    { sep: true },
    { label: 'Cut', icon: Scissors, hint: kbd('Mod+X'), disabled: !canEdit, onClick: () => cutSelection(ed) },
    { label: 'Copy', icon: Copy, hint: kbd('Mod+C'), disabled: !ed, onClick: () => copySelection(ed) },
    { label: 'Paste', icon: ClipboardPaste, hint: kbd('Mod+V'), disabled: !canEdit, onClick: onPaste },
    { label: 'Select all', icon: TextSelect, hint: kbd('Mod+A'), disabled: !ed, onClick: () => chain().selectAll().run() },
    { sep: true },
    { label: 'Find and replace', icon: Search, hint: kbd('Mod+F'), disabled: !ed, onClick: () => emit('find') },
  ];

  const insert = [
    ...SLASH_ITEMS.map((it) => ({ label: it.title, icon: BLOCK_ICONS[it.title], disabled: !canEdit, onClick: () => it.run(chain()).run() })),
    { sep: true },
    { label: 'Link…', icon: Link2, disabled: !canEdit, onClick: () => emit('link') },
  ];

  const view = [
    { label: 'Notes list', icon: PanelLeft, hint: kbd('Mod+\\'), onClick: onToggleSidebar },
    { label: 'Focus mode', icon: Maximize2, hint: kbd('Mod+Shift+F'), onClick: onToggleFocus },
    { sep: true },
    { heading: 'Theme' },
    ...[['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(([v, text]) => ({
      label: text, checked: theme === v, onClick: () => onTheme(v),
    })),
  ];

  const help = [
    { label: 'Keyboard shortcuts', icon: Keyboard, onClick: () => onHelp('shortcuts') },
    { label: 'About Nota', icon: Info, onClick: () => onHelp('about') },
  ];

  const menus = [
    { label: 'File', dot: backupDue, items: file },
    { label: 'Edit', items: edit },
    { label: 'Insert', items: insert },
    { label: 'View', items: view },
    { label: 'Help', items: help },
  ];

  return (
    <header className="appbar">
      <button className="icon-btn" onClick={onToggleSidebar} aria-label="Show notes" title={`Show notes (${kbd('Mod+\\')})`}>
        <PanelLeft size={18} />
      </button>
      <div className="brand"><span className="brand-mark" aria-hidden="true" />Nota</div>

      {mobile ? (
        <>
          <div className="spacer" />
          <Menu
            icon={MoreHorizontal}
            label="Menu"
            dot={backupDue}
            items={menus.flatMap((m) => [{ heading: m.label }, ...m.items.filter((i) => !i.sep)])}
          />
        </>
      ) : (
        <MenuBar menus={menus} />
      )}
    </header>
  );
}
