import { useLayoutEffect, useRef, type HTMLAttributes } from 'react';

/** Manual keyboard traversal: activation still belongs to each workspace's scope guard. */
export function WorkspaceNav({
  active,
  ...props
}: HTMLAttributes<HTMLElement> & {
  active: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const reveal = (item: HTMLElement) => {
    const viewport = ref.current;
    if (!viewport) return;
    const bounds = viewport.getBoundingClientRect(),
      row = item.getBoundingClientRect();
    if (row.left < bounds.left) viewport.scrollLeft -= bounds.left - row.left;
    else if (row.right > bounds.right) viewport.scrollLeft += row.right - bounds.right;
  };
  useLayoutEffect(() => {
    const selected = ref.current?.querySelector<HTMLElement>(
      '[aria-current="page"], [aria-selected="true"]',
    );
    if (selected) reveal(selected);
  }, [active]);
  return (
    <nav
      {...props}
      ref={ref}
      onFocusCapture={(event) => reveal(event.target)}
      onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        const buttons = Array.from(
          event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
        );
        const index = buttons.indexOf(event.target as HTMLButtonElement);
        if (index < 0) return;
        event.preventDefault();
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? buttons.length - 1
              : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus({ preventScroll: true });
      }}
    />
  );
}
