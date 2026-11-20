import Dexie from 'dexie';

export const db = new Dexie('nota');
db.version(1).stores({
  notes: 'id, updatedAt, folderId', // metadata only (cheap to list)
  contents: 'id', // heavy part: editor JSON + plain text for search
  folders: 'id, createdAt',
});

export const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] };
export const TRASH_DAYS = 30;

const now = () => Date.now();
const uid = () =>
  globalThis.crypto?.randomUUID
    ? crypto.randomUUID()
    : 'n' + now().toString(36) + Math.random().toString(36).slice(2, 10);

export const makeSnippet = (text = '') => text.replace(/\s+/g, ' ').trim().slice(0, 140);

export async function createNote({ folderId = null, title = '', json = EMPTY_DOC, text = '' } = {}) {
  const id = uid();
  const t = now();
  await db.transaction('rw', db.notes, db.contents, async () => {
    await db.notes.add({
      id, title, snippet: makeSnippet(text), folderId,
      pinned: false, deletedAt: null, createdAt: t, updatedAt: t,
    });
    await db.contents.add({ id, json, text });
  });
  return id;
}

export async function getContent(id) {
  return db.contents.get(id);
}

/** Save editor output. Bumps updatedAt. */
export async function saveNote(id, { title, json, text }) {
  await db.transaction('rw', db.notes, db.contents, async () => {
    const exists = await db.notes.get(id);
    if (!exists) return; // note was deleted forever while editor was open
    await db.notes.update(id, { title, snippet: makeSnippet(text), updatedAt: now() });
    await db.contents.put({ id, json, text });
  });
}

/** Change metadata (pin, folder, trash). Does not bump updatedAt. */
export const patchNote = (id, patch) => db.notes.update(id, patch);

export const trashNote = (id) => patchNote(id, { deletedAt: now(), pinned: false });
export const restoreNote = (id) => patchNote(id, { deletedAt: null });

export async function deleteForever(ids) {
  const list = Array.isArray(ids) ? ids : [ids];
  await db.transaction('rw', db.notes, db.contents, async () => {
    await db.notes.bulkDelete(list);
    await db.contents.bulkDelete(list);
  });
}

export async function emptyTrash() {
  const ids = (await db.notes.toArray()).filter((n) => n.deletedAt).map((n) => n.id);
  await deleteForever(ids);
  return ids.length;
}

export async function purgeOldTrash() {
  const limit = now() - TRASH_DAYS * 86400000;
  const ids = (await db.notes.toArray()).filter((n) => n.deletedAt && n.deletedAt < limit).map((n) => n.id);
  if (ids.length) await deleteForever(ids);
}

export async function createFolder(name) {
  const clean = name.trim().slice(0, 60);
  if (!clean) return null;
  const id = uid();
  await db.folders.add({ id, name: clean, createdAt: now() });
  return id;
}

export const renameFolder = (id, name) => {
  const clean = name.trim().slice(0, 60);
  return clean ? db.folders.update(id, { name: clean }) : Promise.resolve();
};

/** Deleting a folder never deletes notes. They move to "No folder". */
export async function deleteFolder(id) {
  await db.transaction('rw', db.notes, db.folders, async () => {
    await db.notes.where('folderId').equals(id).modify({ folderId: null });
    await db.folders.delete(id);
  });
}

/** Full-text search. Returns a Set of note ids whose body contains the query. */
export async function searchBodies(query) {
  const q = query.trim().toLowerCase();
  const hits = new Set();
  if (!q) return hits;
  await db.contents.each((c) => {
    if (c.text && c.text.toLowerCase().includes(q)) hits.add(c.id);
  });
  return hits;
}

export async function exportAll() {
  const [notes, contents, folders] = await Promise.all([
    db.notes.toArray(), db.contents.toArray(), db.folders.toArray(),
  ]);
  const byId = new Map(contents.map((c) => [c.id, c]));
  return {
    app: 'nota',
    version: 1,
    exportedAt: new Date().toISOString(),
    folders,
    notes: notes.map((n) => ({ ...n, content: byId.get(n.id)?.json ?? EMPTY_DOC })),
  };
}

/**
 * Restore from a validated backup.
 * Same id + older/equal updatedAt in backup => skipped. Newer in backup => overwritten.
 */
export async function importNotes(notes, folders = []) {
  let added = 0, updated = 0, skipped = 0;
  await db.transaction('rw', db.notes, db.contents, db.folders, async () => {
    for (const f of folders) await db.folders.put(f);
    for (const n of notes) {
      const { content, text, ...meta } = n;
      const old = await db.notes.get(meta.id);
      if (old && old.updatedAt >= meta.updatedAt) { skipped++; continue; }
      await db.notes.put(meta);
      await db.contents.put({ id: meta.id, json: content, text });
      old ? updated++ : added++;
    }
  });
  return { added, updated, skipped };
}

export { uid };
