import Modal from './Modal.jsx';
import { kbd } from '../lib/keys.js';

const SHORTCUTS = [
  ['New note', 'Alt+N'],
  ['Find and replace', 'Mod+F'],
  ['Show or hide notes', 'Mod+\\'],
  ['Focus mode', 'Mod+Shift+F'],
  ['Bold', 'Mod+B'],
  ['Italic', 'Mod+I'],
  ['Underline', 'Mod+U'],
  ['Undo', 'Mod+Z'],
  ['Redo', 'Mod+Shift+Z'],
  ['Insert a block (heading, list…)', '/'],
  ['Open a link', 'Mod+Click'],
];

export default function HelpModal({ kind, onClose }) {
  if (kind === 'about') {
    return (
      <Modal title="About Nota" onClose={onClose}>
        <section className="help-text">
          <p>Nota is a quiet notepad. It works offline and has no account.</p>
          <p>Your notes stay on this device. Nothing is sent anywhere.</p>
          <p>If you clear your browser data, your notes are gone. Use File → Download backup now and then.</p>
        </section>
      </Modal>
    );
  }
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose}>
      <section>
        <dl className="shortcuts">
          {SHORTCUTS.map(([name, combo]) => (
            <div key={name}><dt>{name}</dt><dd>{kbd(combo)}</dd></div>
          ))}
        </dl>
      </section>
    </Modal>
  );
}
