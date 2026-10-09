import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Button, Modal, Skeleton, ErrorState } from '../ui';
import { command, errorText, historyTime, type Writings, type WritingHistory } from './model';

export function WritingEditor({
  item,
  onClose,
  onSaved,
}: {
  item: Writings[number];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [body, setBody] = useState(item.body),
    [reason, setReason] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState(item.status === 'draft' && item.canEdit);
  const dirty = body !== item.body;
  const history = useQuery({
    queryKey: ['gradebook', 'writing-history', item.id, item.revision],
    queryFn: () => api<WritingHistory>(`/api/gradebook/writings/${item.id}/history`),
  });
  const close = () => {
    if (!dirty || window.confirm('შეუნახავი ცვლილებები დაიკარგება. გაგრძელება?')) onClose();
  };
  const save = async (publish = false) => {
    setBusy(true);
    setError('');
    try {
      await command(
        publish
          ? { action: 'writing.publish', id: item.id, revision: item.revision }
          : {
              action: 'writing.save',
              id: item.id,
              revision: item.revision,
              kind: item.kind,
              yearId: item.yearId,
              offeringId: item.offeringId,
              studentId: item.studentId,
              body,
              reason: reason || undefined,
            },
      );
      onSaved();
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onOpenChange={close}
      title={item.snapshot.student}
      description={`${item.snapshot.subject ?? 'დამრიგებლის კომენტარი'} · ${item.status === 'draft' ? 'პირადი მონახაზი' : 'გამოქვეყნებული ჩანაწერი'}`}
      className="gb-modal"
    >
      {editing ? (
        <form
          className="gb-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label className="gb-field">
            აკადემიური ჩანაწერი
            <textarea
              rows={8}
              required
              minLength={5}
              maxLength={5000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          {item.status === 'published' && (
            <>
              <details>
                <summary>წინა ჩანაწერი</summary>
                <p>{item.body}</p>
              </details>
              <label className="gb-field">
                შესწორების მიზეზი
                <textarea
                  required
                  minLength={5}
                  maxLength={1000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            </>
          )}
          <p className="gb-muted">
            {dirty ? 'შეუნახავი ცვლილებები' : 'შენახული ჩანაწერი'}
            {item.status === 'draft'
              ? ' · ოჯახისთვის ჯერ არ ჩანს'
              : ' · ცვლილება ისტორიაში ინახება'}
          </p>
          <Button type="submit" variant="primary" disabled={busy || !dirty}>
            {item.status === 'draft' ? 'მონახაზის შენახვა' : 'შესწორების შენახვა'}
          </Button>
        </form>
      ) : (
        <div className="gb-writings">
          <p>{item.body}</p>
          {item.canEdit && <Button onClick={() => setEditing(true)}>შესწორება</Button>}
        </div>
      )}
      {item.canEdit && item.status === 'draft' && (
        <Button variant="primary" disabled={busy || dirty} onClick={() => void save(true)}>
          გამოქვეყნება
        </Button>
      )}
      <div className="ux-feedback-slot">
        {error && (
          <p className="gb-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="gb-history">
        <h3>ჩანაწერის ისტორია</h3>
        {history.isPending ? (
          <Skeleton rows={2} />
        ) : history.isError ? (
          <ErrorState onRetry={() => void history.refetch()} />
        ) : !history.data.length ? (
          <p className="gb-muted">ჯერ არ გამოქვეყნებულა.</p>
        ) : (
          history.data.map((h) => (
            <article key={h.revision}>
              <strong>
                {h.action === 'publish' ? 'გამოქვეყნება' : 'შესწორება'} · {historyTime(h.at)}
                {h.actor ? ` · ${h.actor}` : ''}
              </strong>
              {h.reason && <p>{h.reason}</p>}
              {h.before && (
                <details>
                  <summary>წინა ტექსტი</summary>
                  <p>{h.before}</p>
                </details>
              )}
              <p>{h.after}</p>
            </article>
          ))
        )}
      </div>
    </Modal>
  );
}
