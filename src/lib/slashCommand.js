import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';

export const SLASH_ITEMS = [
  { title: 'Heading 1', hint: 'Big section title', keys: 'h1 title', run: (c) => c.toggleHeading({ level: 1 }) },
  { title: 'Heading 2', hint: 'Medium section title', keys: 'h2 subtitle', run: (c) => c.toggleHeading({ level: 2 }) },
  { title: 'To-do list', hint: 'Track tasks with checkboxes', keys: 'todo task checkbox check', run: (c) => c.toggleTaskList() },
  { title: 'Bullet list', hint: 'A simple list', keys: 'bullet ul unordered', run: (c) => c.toggleBulletList() },
  { title: 'Numbered list', hint: 'A list with numbers', keys: 'number ol ordered', run: (c) => c.toggleOrderedList() },
  { title: 'Quote', hint: 'Highlight a quote', keys: 'quote blockquote', run: (c) => c.toggleBlockquote() },
  { title: 'Code block', hint: 'Monospaced code', keys: 'code snippet', run: (c) => c.toggleCodeBlock() },
  { title: 'Divider', hint: 'A horizontal line', keys: 'divider line hr rule', run: (c) => c.setHorizontalRule() },
];

const filterItems = (query) => {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_ITEMS;
  return SLASH_ITEMS.filter((i) => i.title.toLowerCase().includes(q) || i.keys.includes(q));
};

/** Plain DOM popup: keeps focus in the editor and avoids React portals. */
function renderPopup() {
  let el, list, items = [], selected = 0, onPick;

  const paint = () => {
    list.innerHTML = '';
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'slash-empty';
      empty.textContent = 'No match';
      list.appendChild(empty);
      return;
    }
    items.forEach((item, i) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'slash-item' + (i === selected ? ' is-selected' : '');
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', String(i === selected));
      const t = document.createElement('span');
      t.className = 'slash-title';
      t.textContent = item.title;
      const h = document.createElement('span');
      h.className = 'slash-hint';
      h.textContent = item.hint;
      row.append(t, h);
      row.addEventListener('mousedown', (e) => { e.preventDefault(); onPick(item); });
      row.addEventListener('mousemove', () => { if (selected !== i) { selected = i; paint(); } });
      list.appendChild(row);
    });
    list.querySelector('.is-selected')?.scrollIntoView({ block: 'nearest' });
  };

  const place = (props) => {
    const rect = props.clientRect?.();
    if (!rect) return;
    const margin = 8;
    const h = el.offsetHeight || 300;
    const w = el.offsetWidth || 280;
    const below = window.innerHeight - rect.bottom;
    const top = below < h + margin && rect.top > h + margin ? rect.top - h - 6 : rect.bottom + 6;
    const left = Math.min(Math.max(margin, rect.left), window.innerWidth - w - margin);
    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
  };

  return {
    onStart(props) {
      el = document.createElement('div');
      el.className = 'slash-menu';
      el.setAttribute('role', 'listbox');
      el.setAttribute('aria-label', 'Insert block');
      list = document.createElement('div');
      el.appendChild(list);
      document.body.appendChild(el);
      items = props.items; selected = 0; onPick = (item) => props.command(item);
      paint(); place(props);
    },
    onUpdate(props) {
      items = props.items; selected = 0; onPick = (item) => props.command(item);
      paint(); place(props);
    },
    onKeyDown({ event }) {
      if (!items.length) return false;
      if (event.key === 'ArrowDown') { selected = (selected + 1) % items.length; paint(); return true; }
      if (event.key === 'ArrowUp') { selected = (selected - 1 + items.length) % items.length; paint(); return true; }
      if (event.key === 'Enter' || event.key === 'Tab') { onPick(items[selected]); return true; }
      return false;
    },
    onExit() {
      el?.remove();
      el = null;
    },
  };
}

export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '/',
        allowedPrefixes: [' '],
        items: ({ query }) => filterItems(query),
        // Never open inside code blocks, where "/" is just a character.
        allow: ({ state, range }) => !state.doc.resolve(range.from).parent.type.spec.code,
        command: ({ editor, range, props }) => {
          const chain = editor.chain().focus().deleteRange(range);
          props.run(chain).run();
        },
        render: renderPopup,
      }),
    ];
  },
});
