import { describe, expect, it, vi } from 'vitest';
import { handleEscapeKey, registerEscapeHandler } from './useEscapeToClose';

function escapeEvent(defaultPrevented = false) {
  return {
    key: 'Escape',
    defaultPrevented,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  };
}

describe('pilha de fechamento por Escape', () => {
  it('fecha apenas a janela superior e depois a janela anterior', () => {
    const parentClose = vi.fn();
    const childClose = vi.fn();
    const removeParent = registerEscapeHandler(parentClose);
    const removeChild = registerEscapeHandler(childClose);

    const childEvent = escapeEvent();
    expect(handleEscapeKey(childEvent)).toBe(true);
    expect(childClose).toHaveBeenCalledTimes(1);
    expect(parentClose).not.toHaveBeenCalled();
    expect(childEvent.preventDefault).toHaveBeenCalled();

    removeChild();
    expect(handleEscapeKey(escapeEvent())).toBe(true);
    expect(parentClose).toHaveBeenCalledTimes(1);
    removeParent();
  });

  it('ignora teclas diferentes e eventos já tratados por controles internos', () => {
    const close = vi.fn();
    const remove = registerEscapeHandler(close);

    expect(handleEscapeKey({ ...escapeEvent(), key: 'Enter' })).toBe(false);
    expect(handleEscapeKey(escapeEvent(true))).toBe(false);
    expect(close).not.toHaveBeenCalled();
    remove();
  });
});
