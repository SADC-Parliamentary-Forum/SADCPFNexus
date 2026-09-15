/**
 * Close a portaled overlay (kebab, popover) before running the next UI action.
 * Opening a confirm dialog in the same click leaves the overlay on document.body
 * at a higher paint order, which swallows the confirm buttons.
 */
export function runAfterOverlayClose(close: () => void, action: () => void): void {
  close();
  globalThis.setTimeout(action, 0);
}
