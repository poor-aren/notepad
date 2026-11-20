import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';

/**
 * items: { label, icon, hint, onClick, danger, checked, disabled } | { heading } | { sep: true }
 * onPick runs before the item's own onClick (used to close the menu).
 */
export function MenuItems({ items, onPick }) {
  return items.map((it, i) => {
    if (it.sep) return <div key={i} className="menu-sep" role="separator" />;
    if (it.heading) return <div key={i} className="menu-heading">{it.heading}</div>;
    const ItemIcon = it.icon;
    return (
      <button
        key={i}
        role="menuitem"
        className={`menu-item ${it.danger ? 'is-danger' : ''}`}
        disabled={it.disabled}
        onClick={() => { onPick?.(); it.onClick?.(); }}
      >
        {ItemIcon ? <ItemIcon size={16} /> : <span className="menu-icon-gap" />}
        <span className="menu-label">{it.label}</span>
        {it.hint && <span className="menu-kbd">{it.hint}</span>}
        {it.checked && <Check size={14} className="menu-check" />}
      </button>
    );
  });
}

export default function Menu({ icon: Icon, label, items, align = 'right', className = '', dot = false, children }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); wrap.current?.querySelector('button')?.focus(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const els = [...wrap.current.querySelectorAll('[role="menuitem"]:not(:disabled)')];
        if (!els.length) return;
        const i = els.indexOf(document.activeElement);
        const next = e.key === 'ArrowDown' ? (i + 1) % els.length : (i - 1 + els.length) % els.length;
        els[next].focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    wrap.current?.querySelector('[role="menuitem"]:not(:disabled)')?.focus();
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  return (
    <div className={`menu-wrap ${className}`} ref={wrap}>
      <button
        className={`icon-btn ${dot ? 'has-dot' : ''}`}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {Icon ? <Icon size={18} /> : children}
        {dot && <span className="dot" aria-hidden="true" />}
      </button>
      {open && (
        <div className={`menu align-${align}`} role="menu" aria-label={label}>
          <MenuItems items={items} onPick={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
