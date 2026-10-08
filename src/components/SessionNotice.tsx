import { useState } from 'react';
import { WifiOff, X } from 'lucide-react';
import { Button, IconButton } from './ui';

/** A failed background check must neither erase work nor take focus from it. */
export function SessionNotice({ pending, retry }: { pending: boolean; retry: () => void }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="product-theme session-notice">
      <WifiOff size={18} aria-hidden="true" />
      <div>
        <p role="status">კავშირი დროებით შეფერხდა. შეუნახავი ცვლილებები შენარჩუნებულია.</p>
        <Button variant="ghost" disabled={pending} onClick={retry}>
          {pending ? 'მოწმდება…' : 'კავშირის შემოწმება'}
        </Button>
      </div>
      <IconButton label="შეტყობინების დახურვა" onClick={() => setDismissed(true)}>
        <X size={16} />
      </IconButton>
    </div>
  );
}
