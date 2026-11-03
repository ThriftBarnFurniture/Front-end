"use client";

import { useEffect, useRef } from "react";

export default function ModalDialog({ children, className, titleId, descriptionId, onClose, busy = false, onClick, onMouseDown }: {
  children: React.ReactNode;
  className: string;
  titleId: string;
  descriptionId?: string;
  onClose: () => void;
  busy?: boolean;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  onMouseDown?: React.MouseEventHandler<HTMLDivElement>;
}) {
  const container = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  const blocked = useRef(busy);
  useEffect(() => { close.current = onClose; blocked.current = busy; }, [onClose, busy]);

  useEffect(() => {
    const dialog = container.current;
    if (!dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () => [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')]
      .filter(element => element.getClientRects().length > 0);
    const focusFirst = () => (focusables()[0] ?? dialog).focus();
    focusFirst();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!blocked.current) close.current();
      }
      if (event.key !== "Tab") return;
      const elements = focusables();
      const first = elements[0];
      const last = elements.at(-1);
      if (!first || !last) { event.preventDefault(); dialog.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const onFocus = (event: FocusEvent) => { if (!dialog.contains(event.target as Node)) focusFirst(); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocus);
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, []);

  return <div ref={container} className={className} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} aria-busy={busy} tabIndex={-1} onClick={onClick} onMouseDown={onMouseDown}>{children}</div>;
}
