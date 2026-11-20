import { Editor, getSchema } from '@tiptap/core';
import { schemaExtensions } from './extensions.js';
import { EMPTY_DOC, exportAll, importNotes, uid } from '../db/db.js';
import { fileSafe } from './format.js';
import { FONTS, SIZES } from './fonts.js';

const MAX_IMPORT_BYTES = 50 * 1024 * 1024; // 50 MB: guards the tab against absurd files
const schema = getSchema(schemaExtensions);

export function download(filename, content, mime = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Export the note that is open in the editor. */
export function exportCurrent(editor, title, format) {
  const name = fileSafe(title);
  if (format === 'txt') {
    return download(`${name}.txt`, `${title ? title + '\n\n' : ''}${editor.getText({ blockSeparator: '\n\n' })}`);
  }
  if (format === 'md') {
    const md = editor.getMarkdown();
    return download(`${name}.md`, `${title ? `# ${title}\n\n` : ''}${md}\n`, 'text/markdown');
  }
  return undefined;
}

export async function backupAll() {
  const data = await exportAll();
  const stamp = new Date().toISOString().slice(0, 10);
  download(`nota-backup-${stamp}.json`, JSON.stringify(data), 'application/json');
  return data.notes.length;
}

/** Throws if the JSON is not a valid document for our schema. */
function assertValidDoc(json) {
  if (!json || json.type !== 'doc') throw new Error('not a doc');
  schema.nodeFromJSON(json).check();
}

function textOf(json) {
  try {
    const node = schema.nodeFromJSON(json);
    return node.textBetween(0, node.content.size, ' ', ' ');
  } catch {
    return '';
  }
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function cleanNote(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return null;
  try {
    assertValidDoc(raw.content);
  } catch {
    return null;
  }
  const t = Date.now();
  return {
    id: raw.id.slice(0, 80),
    title: typeof raw.title === 'string' ? raw.title.slice(0, 300) : '',
    snippet: '', // rebuilt below
    folderId: typeof raw.folderId === 'string' ? raw.folderId : null,
    pinned: raw.pinned === true,
    font: FONTS.some((f) => f.id === raw.font) ? raw.font : null,
    fontSize: SIZES.includes(raw.fontSize) ? raw.fontSize : null,
    deletedAt: isNum(raw.deletedAt) ? raw.deletedAt : null,
    createdAt: isNum(raw.createdAt) ? raw.createdAt : t,
    updatedAt: isNum(raw.updatedAt) ? raw.updatedAt : t,
    content: raw.content,
  };
}

async function importBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  if (!data || data.app !== 'nota' || !Array.isArray(data.notes)) {
    throw new Error('This does not look like a Nota backup.');
  }
  const notes = [];
  let rejected = 0;
  for (const raw of data.notes) {
    const n = cleanNote(raw);
    if (!n) { rejected++; continue; }
    const plain = textOf(n.content);
    n.text = plain;
    n.snippet = plain.replace(/\s+/g, ' ').trim().slice(0, 140);
    notes.push(n);
  }
  const folders = (Array.isArray(data.folders) ? data.folders : [])
    .filter((f) => f && typeof f.id === 'string' && typeof f.name === 'string')
    .map((f) => ({ id: f.id.slice(0, 80), name: f.name.slice(0, 60), createdAt: isNum(f.createdAt) ? f.createdAt : Date.now() }));
  const result = await importNotes(notes, folders);
  return { ...result, rejected, kind: 'backup' };
}

function plainTextDoc(text) {
  const blocks = text.replace(/\r\n?/g, '\n').split(/\n/).map((line) =>
    line ? { type: 'paragraph', content: [{ type: 'text', text: line }] } : { type: 'paragraph' },
  );
  return { type: 'doc', content: blocks.length ? blocks : EMPTY_DOC.content };
}

function markdownToDoc(md) {
  const ed = new Editor({ extensions: schemaExtensions, content: md, contentType: 'markdown' });
  const json = ed.getJSON();
  ed.destroy();
  return json;
}

/** Import a single .txt/.md file as a new note. Returns the note payload (caller creates it). */
function importTextFile(name, text) {
  const base = name.replace(/\.[^.]+$/, '');
  const isMd = /\.(md|markdown)$/i.test(name);
  let json = isMd ? markdownToDoc(text) : plainTextDoc(text);
  let title = base;
  // A leading "# Heading" is the note's title: use it as the title instead of repeating it in the body.
  const first = json.content?.[0];
  if (isMd && first?.type === 'heading' && first.attrs?.level === 1) {
    const h = (first.content || []).map((n) => n.text || '').join('').trim();
    if (h) {
      title = h;
      const rest = json.content.slice(1);
      json = { ...json, content: rest.length ? rest : [{ type: 'paragraph' }] };
    }
  }
  assertValidDoc(json);
  return { title: title.slice(0, 300), json, text: textOf(json), id: uid() };
}

/** Entry point: handles .json backup, .md and .txt. Returns a summary for the toast. */
export async function importFiles(fileList, createNoteFn) {
  const files = [...fileList];
  const summary = { notes: 0, restored: null, failed: [] };
  for (const file of files) {
    if (file.size > MAX_IMPORT_BYTES) { summary.failed.push(`${file.name} (too large)`); continue; }
    try {
      const text = await file.text();
      if (/\.json$/i.test(file.name)) {
        summary.restored = await importBackup(text);
      } else if (/\.(md|markdown|txt)$/i.test(file.name)) {
        const n = importTextFile(file.name, text);
        await createNoteFn({ title: n.title, json: n.json, text: n.text });
        summary.notes++;
      } else {
        summary.failed.push(`${file.name} (unsupported type)`);
      }
    } catch (err) {
      summary.failed.push(`${file.name} (${err.message || 'could not read'})`);
    }
  }
  return summary;
}
