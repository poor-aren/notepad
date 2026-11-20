import { useEffect, useState } from 'react';
import { useEditorState } from '@tiptap/react';
import {
  FilePlus, FolderOpen, Save, Printer, Scissors, Copy, ClipboardPaste, Undo2, Redo2, Bold, Italic, Underline,
  Highlighter, Link2, Unlink, Check, Search, Maximize2,
} from 'lucide-react';
import { FONTS, SIZES, noteFont, noteSize } from '../lib/fonts.js';
import { cutSelection, copySelection, normalizeUrl } from '../lib/editorActions.js';
import { emit, on } from '../lib/bus.js';
import { kbd } from '../lib/keys.js';
import { patchNote } from '../db/db.js';

const IDLE = { bold: false, italic: false, underline: false, highlight: false, link: false, hasSel: false, canUndo: false, canRedo: false };

function Btn({ icon: Icon, label, hint, onClick, disabled, active }) {
  return (
    <button
      type="button"
      className={`icon-btn ${active ? 'is-active' : ''}`}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      title={hint ? `${label} (${hint})` : label}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} // keep the editor selection
      onClick={onClick}
    >
      <Icon size={17} />
    </button>
  );
}

const Sep = () => <span className="tb-sep" role="separator" aria-orientation="vertical" />;

export default function Toolbar({ editor, note, onNew, onOpen, onPaste, onToggleFocus }) {
  const trashed = !!note?.deletedAt;
  const ed = note && !trashed ? editor : null;
  const canEdit = !!ed && ed.isEditable;
  const [linking, setLinking] = useState(false);
  const [url, setUrl] = useState('');

  const st = useEditorState({
    editor: ed,
    selector: ({ editor: e }) => (e ? {
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      highlight: e.isActive('highlight'),
      link: e.isActive('link'),
      hasSel: !e.state.selection.empty,
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    } : IDLE),
  });

  const startLink = () => {
    if (!canEdit) return;
    setUrl(ed.getAttributes('link').href || '');
    setLinking(true);
  };

  // "Insert > Link…" asks for the same popover.
  useEffect(() => on('link', startLink)); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!ed) setLinking(false); }, [ed]);

  const applyLink = () => {
    const href = normalizeUrl(url);
    const chain = ed.chain().focus().extendMarkRange('link');
    if (!href) chain.unsetLink().run();
    else chain.setLink({ href }).run();
    setLinking(false);
  };

  const mark = (name) => () => ed.chain().focus()[`toggle${name}`]().run();

  return (
    <div className="toolbar-wrap">
      <div className="toolbar" role="toolbar" aria-label="Tools">
        <Btn icon={FilePlus} label="New note" hint={kbd('Alt+N')} onClick={onNew} />
        <Btn icon={FolderOpen} label="Open files" onClick={onOpen} />
        <Btn icon={Save} label="Save as Markdown" disabled={!ed} onClick={() => emit('export', { format: 'md' })} />
        <Btn icon={Printer} label="Print or save as PDF" disabled={!ed} onClick={() => emit('export', { format: 'pdf' })} />
        <Sep />
        <Btn icon={Scissors} label="Cut" hint={kbd('Mod+X')} disabled={!canEdit} onClick={() => cutSelection(ed)} />
        <Btn icon={Copy} label="Copy" hint={kbd('Mod+C')} disabled={!ed} onClick={() => copySelection(ed)} />
        <Btn icon={ClipboardPaste} label="Paste" hint={kbd('Mod+V')} disabled={!canEdit} onClick={onPaste} />
        <Sep />
        <Btn icon={Undo2} label="Undo" hint={kbd('Mod+Z')} disabled={!canEdit || !st.canUndo} onClick={() => ed.chain().focus().undo().run()} />
        <Btn icon={Redo2} label="Redo" hint={kbd('Mod+Shift+Z')} disabled={!canEdit || !st.canRedo} onClick={() => ed.chain().focus().redo().run()} />
        <Sep />
        <Btn icon={Bold} label="Bold" hint={kbd('Mod+B')} active={st.bold} disabled={!canEdit} onClick={mark('Bold')} />
        <Btn icon={Italic} label="Italic" hint={kbd('Mod+I')} active={st.italic} disabled={!canEdit} onClick={mark('Italic')} />
        <Btn icon={Underline} label="Underline" hint={kbd('Mod+U')} active={st.underline} disabled={!canEdit} onClick={mark('Underline')} />
        <Btn icon={Highlighter} label="Highlight" active={st.highlight} disabled={!canEdit} onClick={mark('Highlight')} />
        <Btn icon={Link2} label="Link" active={st.link} disabled={!canEdit || (!st.hasSel && !st.link)} onClick={startLink} />
        <Sep />
        <Btn icon={Search} label="Find and replace" hint={kbd('Mod+F')} disabled={!ed} onClick={() => emit('find')} />
        <Sep />
        <select
          className="tb-select"
          aria-label="Font"
          title="Font (this note)"
          value={noteFont(note)}
          disabled={!ed}
          onChange={(e) => patchNote(note.id, { font: e.target.value })}
        >
          {FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <select
          className="tb-select"
          aria-label="Font size"
          title="Font size (this note)"
          value={noteSize(note)}
          disabled={!ed}
          onChange={(e) => patchNote(note.id, { fontSize: Number(e.target.value) })}
        >
          {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="tb-spacer" />
        <Btn icon={Maximize2} label="Focus mode" hint={kbd('Mod+Shift+F')} onClick={onToggleFocus} />
      </div>

      {linking && ed && (
        <form className="tb-pop" onSubmit={(e) => { e.preventDefault(); applyLink(); }}>
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setLinking(false); ed.view.focus(); } }}
            placeholder="Paste a link, then press Enter"
            aria-label="Link address"
            spellCheck={false}
          />
          <button type="submit" className="icon-btn sm" aria-label="Apply link" title="Apply link"><Check size={16} /></button>
          {st.link && (
            <button
              type="button"
              className="icon-btn sm"
              aria-label="Remove link"
              title="Remove link"
              onClick={() => { ed.chain().focus().extendMarkRange('link').unsetLink().run(); setLinking(false); }}
            >
              <Unlink size={16} />
            </button>
          )}
        </form>
      )}
    </div>
  );
}
