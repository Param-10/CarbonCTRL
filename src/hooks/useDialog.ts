import { RefObject, useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keyboard behavior for a modal dialog while `open`: moves focus into it (to
 * the element marked `data-autofocus`, else the first focusable one), keeps Tab
 * inside it, closes on Escape, and returns focus to whatever opened it.
 * `onClose` should ignore the request while the dialog is busy (e.g. saving).
 */
export function useDialog(dialogRef: RefObject<HTMLElement>, open: boolean, onClose: () => void) {
  // Latest onClose without re-running the effect, which would steal focus back on every render
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusable = () => [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
    (dialog.querySelector<HTMLElement>('[data-autofocus]') ?? focusable()[0] ?? dialog).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      opener?.focus();
    };
  }, [dialogRef, open]);
}
