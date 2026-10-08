/** Text fields match :focus-visible even after a click. Track focus navigation,
 * not ordinary typing, so a pointer-opened form keeps its restrained boundary. */
export function installFocusModality() {
  const root = document.documentElement;
  root.dataset.focusMethod = 'keyboard';
  const pointer = () => {
    root.dataset.focusMethod = 'pointer';
  };
  const keyboard = (event: KeyboardEvent) => {
    const combobox =
      event.target instanceof HTMLElement && event.target.matches('[role="combobox"]');
    const editable =
      event.target instanceof HTMLElement &&
      (event.target.matches('input, textarea, [contenteditable="true"]') ||
        event.target.isContentEditable);
    if (
      event.key === 'Tab' ||
      ((!editable || combobox) &&
        ['Enter', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(
          event.key,
        ))
    ) {
      root.dataset.focusMethod = 'keyboard';
    }
  };
  document.addEventListener('pointerdown', pointer, true);
  document.addEventListener('keydown', keyboard, true);
  return () => {
    document.removeEventListener('pointerdown', pointer, true);
    document.removeEventListener('keydown', keyboard, true);
    delete root.dataset.focusMethod;
  };
}
