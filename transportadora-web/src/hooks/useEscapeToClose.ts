import { useEffect, useRef } from 'react';

type EscapeKeyEvent = Pick<KeyboardEvent, 'key' | 'defaultPrevented' | 'preventDefault' | 'stopPropagation'>;
type EscapeHandler = { id: symbol; close: () => void };

const handlers: EscapeHandler[] = [];
let listening = false;

export function handleEscapeKey(event: EscapeKeyEvent) {
  if (event.key !== 'Escape' || event.defaultPrevented) return false;
  const current = handlers[handlers.length - 1];
  if (!current) return false;

  event.preventDefault();
  event.stopPropagation();
  current.close();
  return true;
}

export function registerEscapeHandler(close: () => void) {
  const entry = { id: Symbol('escape-handler'), close };
  handlers.push(entry);
  syncDocumentListener();

  return () => {
    const index = handlers.findIndex((handler) => handler.id === entry.id);
    if (index >= 0) handlers.splice(index, 1);
    syncDocumentListener();
  };
}

export function useEscapeToClose(onClose: () => void, enabled = true) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!enabled) return undefined;
    return registerEscapeHandler(() => onCloseRef.current());
  }, [enabled]);
}

function syncDocumentListener() {
  if (typeof document === 'undefined') return;
  if (handlers.length > 0 && !listening) {
    document.addEventListener('keydown', handleEscapeKey);
    listening = true;
  } else if (!handlers.length && listening) {
    document.removeEventListener('keydown', handleEscapeKey);
    listening = false;
  }
}
