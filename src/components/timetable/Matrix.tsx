import { useEffect, useState } from 'react';
import { GripVertical, Plus, AlertTriangle, ArrowUpRight } from 'lucide-react';
import type { Bell, TimetableConflict } from '../../../shared/timetable';
import { weekdayLabels } from '../../../shared/timetable';
import type { Lens, Tile } from './model';
import { post, shift } from './Forms';
export type Move = { lessonId: string; weekday: number; periodId: string; revision: number };
export function Matrix({
  items,
  periods,
  from,
  lens,
  editable,
  versionId,
  revision,
  conflicts,
  changed,
  selected,
  onSelect,
  onAdd,
  onMove,
  initialDay = 0,
}: {
  initialDay?: number;
  items: Tile[];
  periods: Bell[];
  from: string;
  lens: Lens;
  editable: boolean;
  versionId: string;
  revision: number;
  conflicts: TimetableConflict[];
  changed: Set<string>;
  selected?: string;
  onSelect: (t: Tile) => void;
  onAdd: (weekday: number, periodId: string) => void;
  onMove: (m: Move) => void;
}) {
  const [day, setDay] = useState(initialDay),
    [drag, setDrag] = useState(''),
    [hover, setHover] = useState<{ weekday: number; periodId: string } | null>(null),
    [state, setState] = useState('checking');
  useEffect(() => {
    if (!drag || !hover) return;
    let alive = true;
    const timer = setTimeout(() => {
      void post<{ conflicts: TimetableConflict[] }>('/api/timetable/move-preview', {
        id: versionId,
        revision,
        lessonId: drag,
        ...hover,
      })
        .then((r) => {
          if (alive)
            setState(
              r.conflicts.some((c) => !c.overridable)
                ? 'invalid'
                : r.conflicts.length
                  ? 'conflict'
                  : 'clear',
            );
        })
        .catch(() => {
          if (alive) setState('stale');
        });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [drag, hover, versionId, revision]);
  const days = [
    ...weekdayLabels,
    ...(!editable && (initialDay > 4 || items.some((t) => t.weekday > 5))
      ? ['შაბათი', 'კვირა']
      : []),
  ];
  const rows = [...periods].sort((a, b) => a.number - b.number);
  for (const tile of items)
    if (!rows.some((p) => p.number === tile.number))
      rows.push({
        id: tile.occurrence?.periodId ?? '',
        number: tile.number,
        start: tile.start,
        end: tile.end,
        weekdays: [1, 2, 3, 4, 5],
        teaching: true,
      });
  rows.sort((a, b) => a.number - b.number);
  return (
    <>
      <div className="tt-mobile-days" aria-label="დღის არჩევა">
        {days.map((d, i) => (
          <button key={d} aria-pressed={i === day} onClick={() => setDay(i)}>
            {d.slice(0, 3)}
          </button>
        ))}
      </div>
      <div className="tt-matrix-scroll">
        <table className="tt-matrix" aria-label="კვირის პერიოდული განრიგი">
          <thead>
            <tr>
              <th scope="col" className="tt-axis-head">
                პერიოდი
              </th>
              {days.map((d, i) => (
                <th scope="col" key={d} className={i === day ? 'tt-active-day' : ''}>
                  {d}
                  <span className="product-number">
                    {shift(from, i).slice(5).replace('-', ' / ')}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.number} className={!p.teaching ? 'tt-break-row' : ''}>
                <th scope="row" className="tt-axis">
                  <b className="product-number">{String(p.number).padStart(2, '0')}</b>
                  <span>
                    {p.start}
                    <br />
                    {p.end}
                  </span>
                  {!p.teaching && <small>შესვენება</small>}
                </th>
                {days.map((d, i) => {
                  const cell = items.filter((t) => t.weekday === i + 1 && t.number === p.number),
                    allowed = editable && p.teaching && p.weekdays.includes(i + 1),
                    target = drag && hover?.weekday === i + 1 && hover.periodId === p.id;
                  return (
                    <td
                      key={d}
                      data-day={i + 1}
                      data-period={p.number}
                      data-drop-state={target ? state : undefined}
                      className={`${i === day ? 'tt-active-day' : ''} ${drag && allowed ? 'tt-can-drop' : ''}`}
                      onDragEnter={(e) => {
                        if (!allowed) return;
                        e.preventDefault();
                        if (hover?.weekday !== i + 1 || hover.periodId !== p.id) {
                          setState('checking');
                          setHover({ weekday: i + 1, periodId: p.id });
                        }
                      }}
                      onDragOver={(e) => {
                        if (allowed) e.preventDefault();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const lessonId = e.dataTransfer.getData('text/plain');
                        setDrag('');
                        if (allowed && lessonId)
                          onMove({ lessonId, weekday: i + 1, periodId: p.id, revision });
                      }}
                    >
                      <div className="tt-cell">
                        {cell.map((t) => {
                          const conflict = conflicts.some((c) =>
                            c.lessonIds.some((id) => id === t.id || id.includes(`:${t.lessonId}:`)),
                          );
                          return (
                            <button
                              key={t.id}
                              className={`tt-tile ${selected === t.id ? 'is-selected' : ''} ${drag === t.lessonId ? 'is-dragging' : ''} ${conflict ? 'is-conflict' : ''} ${t.cancelled ? 'is-cancelled' : ''} ${changed.has(t.lessonId) ? 'is-modified' : ''}`}
                              draggable={editable}
                              aria-label={`${t.subject} · ${d} · ${p.number} · ${t.group}`}
                              onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', t.lessonId);
                                setDrag(t.lessonId);
                              }}
                              onDragEnd={() => {
                                setDrag('');
                                setHover(null);
                              }}
                              onClick={() => onSelect(t)}
                            >
                              <span className="tt-tile-title">
                                {t.subject}
                                {editable ? <GripVertical size={13} /> : <ArrowUpRight size={12} />}
                              </span>
                              <span className="tt-tile-meta">
                                {lens.kind === 'teacher' ? t.group : t.teacher}
                              </span>
                              <span className="tt-tile-foot">
                                <span>{lens.kind === 'room' ? t.group : `ოთახი ${t.room}`}</span>
                                {t.start !== p.start && <time>{t.start}</time>}
                                {conflict ? (
                                  <em>
                                    <AlertTriangle size={12} />
                                    კონფლიქტი
                                  </em>
                                ) : t.changed ? (
                                  <em>
                                    {t.cancelled
                                      ? 'გაუქმება'
                                      : t.occurrence?.exceptionalDay
                                        ? 'საგანგებო'
                                        : 'ცვლილება'}
                                  </em>
                                ) : changed.has(t.lessonId) ? (
                                  <em>შეცვლილი</em>
                                ) : null}
                              </span>
                              {lens.kind === 'section' && (
                                <span className="tt-tile-group">{t.group}</span>
                              )}
                            </button>
                          );
                        })}
                        {allowed && (
                          <button
                            className="tt-cell-add"
                            aria-label={`${d} · ${p.number} · დამატება`}
                            onClick={() => onAdd(i + 1, p.id)}
                          >
                            <Plus size={14} />
                            <span>დამატება</span>
                          </button>
                        )}
                        {!cell.length && !allowed && (
                          <span className="tt-cell-free" aria-label="თავისუფალი პერიოდი">
                            —
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <div className="tt-no-schedule">
          გამოქვეყნებული განრიგი ჯერ არ არის. სამუშაო ვერსია ხელმისაწვდომია მხოლოდ
          ადმინისტრაციისთვის.
        </div>
      )}
      {drag && hover && (
        <div className={`tt-drag-status ${state}`} role="status">
          {state === 'checking'
            ? 'სერვერი ამოწმებს პოზიციას…'
            : state === 'clear'
              ? 'პოზიცია თავისუფალია · გაუშვით გადასახედად'
              : state === 'conflict'
                ? 'კონფლიქტი · საჭიროა განხილვა'
                : state === 'invalid'
                  ? 'მოქმედი მონაცემები არ შეესაბამება პოზიციას'
                  : 'შემოწმება ვერ დასრულდა · განაახლეთ განრიგი'}
        </div>
      )}
    </>
  );
}
