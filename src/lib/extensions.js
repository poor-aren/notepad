import StarterKit from '@tiptap/starter-kit';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { TableKit } from '@tiptap/extension-table';
import { Highlight } from '@tiptap/extension-highlight';
import { Markdown } from '@tiptap/markdown';

/**
 * Document schema shared by the live editor, the importer and the backup validator.
 * Anything that changes the schema must be added here so all three stay in sync.
 */
export const schemaExtensions = [
  StarterKit.configure({
    link: {
      openOnClick: false,
      autolink: true,
      HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
    },
  }),
  TaskList,
  TaskItem.configure({ nested: true }),
  TableKit.configure({ table: { resizable: false } }),
  Highlight,
  Markdown,
];
