import { useEffect, useRef, useState } from 'react';
import { MenuItems } from './Menu.jsx';

/** Desktop menu bar. menus: [{ label, dot?, items }]. Hover switches menus while one is open. */
export default function MenuBar({ menus }) {
  const [open, setOpen] = useState(null);
  const bar = useRef(null);
  const n = menus.length;

  useEffect(() => {
    if (open === null) return undefined;
    const onDown = (e) => { if (!bar.current?.contains(e.target)) setOpen(null); };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        bar.current?.querySelectorAll('.menubar-btn')[open]?.focus();
        setOpen(null);
      } else if (e.key === 'ArrowRight') { e.preventDefault(); setOpen((o) => (o + 1) % n); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setOpen((o) => (o - 1 + n) % n); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const els = [...bar.current.querySelectorAll('[role="menuitem"]:not(:disabled)')];
        if (!els.length) return;
        const i = els.indexOf(document.activeElement);
        els[e.key === 'ArrowDown' ? (i + 1) % els.length : (i - 1 + els.length) % els.length].focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, n]);

  // Move focus into the menu that just opened.
  useEffect(() => {
    if (open !== null) bar.current?.querySelector('[role="menuitem"]:not(:disabled)')?.focus();
  }, [open]);

  return (
    <nav className="menubar" ref={bar} aria-label="Menu">
      {menus.map((m, i) => (
        <div className="menu-wrap" key={m.label}>
          <button
            className={`menubar-btn ${open === i ? 'is-open' : ''}`}
            aria-haspopup="menu"
            aria-expanded={open === i}
            onClick={() => setOpen(open === i ? null : i)}
            onMouseEnter={() => { if (open !== null) setOpen(i); }}
          >
            {m.label}
            {m.dot && <span className="dot" aria-label="Backup recommended" />}
          </button>
          {open === i && (
            <div className="menu align-left" role="menu" aria-label={m.label}>
              <MenuItems items={m.items} onPick={() => setOpen(null)} />
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}
