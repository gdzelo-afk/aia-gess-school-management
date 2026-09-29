import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Plus,
  Search,
  SlidersHorizontal,
  X,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { people, sections, type Person } from './data';
import { Avatar, Empty, Kbd, Modal, Status } from './primitives';
import type { LabActions } from './DesignLab';
export function Students({ direction, notify, openModal }: LabActions) {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [section, setSection] = useState(params.get('section') || '');
  const [review, setReview] = useState(params.get('status') === 'review');
  const [dense, setDense] = useState(direction === 'b');
  const [descending, setDescending] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [state, setState] = useState<'ready' | 'loading' | 'error'>('ready');
  const person = people.find((p) => p.id === params.get('person'));
  const rows = people
    .filter(
      (p) =>
        (!section || p.section === section) &&
        (!review || p.status === 'გადასამოწმებელი') &&
        (p.name + ' ' + p.id).toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'ka') * (descending ? -1 : 1));
  useEffect(() => {
    if (state !== 'loading') return;
    const t = setTimeout(() => setState('ready'), 850);
    return () => clearTimeout(t);
  }, [state]);
  const reset = () => {
    setQuery('');
    setSection('');
    setReview(false);
  };
  const inspect = (p: Person) =>
    setParams((prev) => {
      prev.set('person', p.id);
      return prev;
    });
  const close = () =>
    setParams((prev) => {
      prev.delete('person');
      return prev;
    });
  return (
    <div className={`dl-people dl-people-${direction} ${dense ? 'dl-dense' : ''}`}>
      <div className="dl-page-heading">
        <div>
          <span className="dl-eyebrow">ადამიანები / სასწავლო წელი 2026—2027</span>
          <h1>
            მოსწავლეები<span className="dl-title-count">12</span>
          </h1>
          <p>ყველა მოსწავლე. თითოეული ისტორია.</p>
        </div>
        <button className="dl-primary" onClick={() => openModal('invite')}>
          <Plus size={16} /> ახალი მოსწავლის ნიმუში
        </button>
      </div>
      <div className="dl-workspace-tabs">
        <button className={!review ? 'active' : ''} onClick={() => setReview(false)}>
          ყველა მოსწავლე <span>12</span>
        </button>
        <button className={review ? 'active' : ''} onClick={() => setReview(true)}>
          გადასამოწმებელი <span>2</span>
        </button>
        <span className="dl-tab-end">I სემესტრი</span>
      </div>
      <div className="dl-people-toolbar">
        <label className="dl-input-search">
          <Search size={17} />
          <input
            aria-label="მოსწავლის ძიება"
            placeholder="სახელი ან მოსწავლის ნომერი…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button aria-label="ძიების გასუფთავება" onClick={() => setQuery('')}>
              <X size={14} />
            </button>
          )}
        </label>
        <label className="dl-select-filter">
          <Filter size={15} />
          <select
            aria-label="კლასის ფილტრი"
            value={section}
            onChange={(e) => setSection(e.target.value)}
          >
            <option value="">ყველა კლასი</option>
            {sections.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <details className="dl-menu">
          <summary aria-label="ხედის პარამეტრები">
            <SlidersHorizontal size={17} />
            <span>ხედის პარამეტრები</span>
          </summary>
          <div>
            <button onClick={() => setDense((d) => !d)}>
              {dense ? 'თავისუფალი რიგები' : 'კომპაქტური რიგები'} {dense && <Check size={15} />}
            </button>
            <button
              onClick={(e) => {
                setState('loading');
                e.currentTarget.closest('details')?.removeAttribute('open');
              }}
            >
              ჩატვირთვის სცენარი
            </button>
            <button
              onClick={(e) => {
                setState('error');
                e.currentTarget.closest('details')?.removeAttribute('open');
              }}
            >
              შეცდომის სცენარი
            </button>
            <button onClick={() => notify('ექსპორტი ვიზუალური კვლევის ფარგლებს სცდება')}>
              <Download size={14} /> ექსპორტის შესახებ
            </button>
          </div>
        </details>
      </div>
      <div className="dl-data-surface">
        {state === 'loading' ? (
          <div className="dl-loading" role="status" aria-label="იტვირთება">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i}>
                <i />
                <span />
                <span />
                <span />
              </div>
            ))}
          </div>
        ) : state === 'error' ? (
          <div className="dl-state" role="alert">
            <AlertCircle size={30} />
            <h3>სიის ჩატვირთვა ვერ მოხერხდა</h3>
            <p>შეცდომის საილუსტრაციო სცენარი. სცადეთ ხელახლა.</p>
            <button className="dl-primary" onClick={() => setState('loading')}>
              <RotateCcw size={16} /> ხელახლა ცდა
            </button>
          </div>
        ) : !rows.length ? (
          <Empty reset={reset} />
        ) : (
          <div className="dl-table-scroll">
            <table className="dl-people-table">
              <thead>
                <tr>
                  <th>
                    <input
                      aria-label="ყველა ნაჩვენები მოსწავლის მონიშვნა"
                      type="checkbox"
                      checked={rows.every((p) => selected.includes(p.id))}
                      onChange={(e) => setSelected(e.target.checked ? rows.map((p) => p.id) : [])}
                    />
                  </th>
                  <th>
                    <button onClick={() => setDescending((d) => !d)}>
                      მოსწავლე{' '}
                      <ArrowDown
                        size={13}
                        style={{ transform: descending ? 'rotate(180deg)' : undefined }}
                      />
                    </button>
                  </th>
                  <th>ნომერი</th>
                  <th>კლასი</th>
                  <th>სტატუსი</th>
                  <th>სასწავლო წელი</th>
                  <th>
                    <span className="dl-sr">გახსნა</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className={selected.includes(p.id) ? 'selected' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`${p.name} — მონიშვნა`}
                        checked={selected.includes(p.id)}
                        onChange={() =>
                          setSelected((prev) =>
                            prev.includes(p.id)
                              ? prev.filter((id) => id !== p.id)
                              : [...prev, p.id],
                          )
                        }
                      />
                    </td>
                    <td>
                      <button className="dl-person-button" onClick={() => inspect(p)}>
                        <Avatar person={p} />
                        <span>
                          {p.name}
                          <small>{p.id}</small>
                          {p.status === 'გადასამოწმებელი' && (
                            <span className="dl-mobile-review">გადასამოწმებელი</span>
                          )}
                        </span>
                      </button>
                    </td>
                    <td className="dl-mono">{p.id}</td>
                    <td>
                      <span className="dl-class-token">{p.section}</span>
                    </td>
                    <td>
                      <Status review={p.status === 'გადასამოწმებელი'} />
                    </td>
                    <td>2026—2027</td>
                    <td>
                      <button
                        className="dl-icon"
                        aria-label={`${p.name} — დეტალები`}
                        onClick={() => inspect(p)}
                      >
                        <ArrowUpRight size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <footer className="dl-table-footer">
          <span>{rows.length} / 12 მოსწავლე</span>
          <span>გამოგონილი მონაცემები</span>
          <div>
            <button className="dl-icon" aria-label="წინა გვერდი" disabled>
              <ChevronLeft size={15} />
            </button>
            <span>01</span>
            <button className="dl-icon" aria-label="შემდეგი გვერდი" disabled>
              <ChevronRight size={15} />
            </button>
          </div>
        </footer>
      </div>
      {selected.length > 0 && (
        <div className="dl-selection-bar">
          <span>
            <Check size={16} /> {selected.length} მონიშნულია
          </span>
          <button onClick={() => notify('ჯგუფური მოქმედების ნიმუში — ჩანაწერები არ შეცვლილა')}>
            ჯგუფური მოქმედება <ArrowUpRight size={14} />
          </button>
          <button aria-label="მონიშვნის გაუქმება" onClick={() => setSelected([])}>
            <X size={16} />
          </button>
        </div>
      )}
      {person && (
        <Modal
          title="მოსწავლის პროფილი"
          description="გამოგონილი პირი · ვიზუალური ნიმუში"
          close={close}
          className="dl-inspector"
        >
          <div className="dl-inspector-identity">
            <Avatar person={person} large />
            <span className="dl-eyebrow">{person.id}</span>
            <h2>{person.name}</h2>
            <Status review={person.status === 'გადასამოწმებელი'} />
          </div>
          <div className="dl-inspector-tabs">
            <strong>მიმოხილვა</strong>
            <span>2026—2027</span>
          </div>
          <dl className="dl-profile-fields">
            <div>
              <dt>კლასი</dt>
              <dd>{person.section}</dd>
            </div>
            <div>
              <dt>სემესტრი</dt>
              <dd>I სემესტრი</dd>
            </div>
            <div>
              <dt>ჩარიცხვა</dt>
              <dd>1 სექტემბერი, 2026</dd>
            </div>
            <div>
              <dt>მეურვე</dt>
              <dd>{person.guardian}</dd>
            </div>
          </dl>
          <form
            className="dl-inspector-note"
            onSubmit={(e) => {
              e.preventDefault();
              notify('შენიშვნის ნიმუში შემოწმებულია — სერვერზე არ შენახულა');
              close();
            }}
          >
            <label>
              სამუშაო შენიშვნის ნიმუში
              <textarea rows={3} placeholder="შეიყვანეთ საილუსტრაციო შენიშვნა…" required />
            </label>
            <button className="dl-primary">
              ნიმუშის შენახვა <Check size={16} />
            </button>
          </form>
          <p className="dl-inspector-footnote">
            აკადემიური და ფინანსური უფლებები მთავარ სისტემაში დამოუკიდებლად მოწმდება. ეს პროფილი
            მხოლოდ დიზაინის ნიმუშია.
          </p>
        </Modal>
      )}
    </div>
  );
}
export function Gradebook({ direction, notify, openModal }: LabActions) {
  const [subject, setSubject] = useState('ქართული ენა');
  const [section, setSection] = useState('ყველა კლასი');
  const [values, setValues] = useState<Record<string, string>>({});
  const [changed, setChanged] = useState(false);
  const [compact, setCompact] = useState(direction === 'b');
  const dates = ['21', '22', '23', '24', '25', '28', '29', '30'];
  const pupils = people.filter((p) => section === 'ყველა კლასი' || p.section === section);
  const key = (id: string, c: number) => `${subject}-${id}-${c}`;
  const value = (p: Person, c: number) => values[key(p.id, c)] ?? (c < 5 ? p.grades[c]! : '');
  const summary = pupils
    .flatMap((p) => dates.map((_, c) => Number(value(p, c))))
    .filter((n) => n >= 1 && n <= 10);
  function move(r: number, c: number, k: string) {
    let nr = r,
      nc = c;
    if (k === 'ArrowDown' || k === 'Enter') nr++;
    else if (k === 'ArrowUp') nr--;
    else if (k === 'ArrowLeft') nc--;
    else if (k === 'ArrowRight') nc++;
    else return false;
    const cell = document.getElementById(
      `grade-${Math.max(0, Math.min(pupils.length - 1, nr))}-${Math.max(0, Math.min(dates.length - 1, nc))}`,
    );
    cell?.focus({ preventScroll: true });
    cell?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const scroller = cell?.closest('.dl-grade-grid-wrap');
    if (cell && scroller) {
      const pinnedWidth = scroller.querySelector('th')!.getBoundingClientRect().width;
      const hidden =
        scroller.getBoundingClientRect().left + pinnedWidth - cell.getBoundingClientRect().left;
      if (hidden > 0) scroller.scrollLeft -= hidden + 2;
    }
    return true;
  }
  return (
    <div className={`dl-gradebook ${compact ? 'dl-dense' : ''}`}>
      <div className="dl-page-heading">
        <div>
          <span className="dl-eyebrow">სასწავლო პროცესი / ვიზუალური პროტოტიპი</span>
          <h1>შეფასების ჟურნალი</h1>
          <p>ფოკუსი თითოეულ მოსწავლეზე.</p>
        </div>
        <button className="dl-primary" onClick={() => openModal('publish')}>
          მიმოხილვა <ArrowUpRight size={17} />
        </button>
      </div>
      <div className="dl-subject-tabs">
        {['ქართული ენა', 'მათემატიკა', 'ინგლისური ენა'].map((s) => (
          <button key={s} className={subject === s ? 'active' : ''} onClick={() => setSubject(s)}>
            {s}
          </button>
        ))}
      </div>
      <div className="dl-grade-controls">
        <label>
          <select
            aria-label="ჟურნალის კლასი"
            value={section}
            onChange={(e) => setSection(e.target.value)}
          >
            <option>ყველა კლასი</option>
            {sections.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <span>სექტემბერი 2026</span>
        <span className="dl-edit-state">
          <i />
          {changed ? 'შეცვლილია ამ ნიმუშში' : 'სამუშაო ნიმუში'}
        </span>
        <button
          className="dl-icon"
          aria-label="ჟურნალის სიმჭიდროვე"
          onClick={() => setCompact(!compact)}
        >
          <SlidersHorizontal size={17} />
        </button>
      </div>
      <p className="dl-mobile-scroll-hint">სხვა თარიღების სანახავად გადაახვიეთ ცხრილი ↔</p>
      <div
        className="dl-grade-grid-wrap"
        tabIndex={0}
        role="region"
        aria-label="შეფასებების ცხრილი"
      >
        <table className="dl-grade-grid">
          <caption className="dl-sr">
            გამოგონილი შეფასებები, 1–10. ისრებით გადაადგილება, Enter შემდეგი მოსწავლე.
          </caption>
          <thead>
            <tr>
              <th>
                <UsersHeader /> მოსწავლე <small>{pupils.length}</small>
              </th>
              {dates.map((d, i) => (
                <th key={d} className={d === '28' ? 'current' : ''}>
                  <span>{['ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'ორშ', 'სამ', 'ოთხ'][i]}</span>
                  {d}
                </th>
              ))}
              <th className="dl-grade-mean">
                საშუალო<small>ნიმუში</small>
              </th>
            </tr>
          </thead>
          <tbody>
            {pupils.map((p, r) => {
              const nums = dates.map((_, c) => Number(value(p, c))).filter((n) => n > 0 && n <= 10);
              return (
                <tr key={p.id}>
                  <th>
                    <span className="dl-row-index">{String(r + 1).padStart(2, '0')}</span>
                    <span>
                      {p.name}
                      <small>
                        {p.section} · {p.id}
                      </small>
                    </span>
                  </th>
                  {dates.map((d, c) => (
                    <td
                      key={d}
                      className={`${d === '28' ? 'current' : ''} ${Number(value(p, c)) === 10 ? 'excellent' : ''}`}
                    >
                      <input
                        id={`grade-${r}-${c}`}
                        aria-label={`${p.name}, ${d} სექტემბერი`}
                        type="text"
                        inputMode="numeric"
                        pattern="([1-9]|10)"
                        maxLength={2}
                        value={value(p, c)}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v !== '' && !/^([1-9]|10)$/.test(v)) {
                            notify('შეფასება უნდა იყოს 1-დან 10-მდე');
                            return;
                          }
                          setValues((prev) => ({ ...prev, [key(p.id, c)]: v }));
                          setChanged(true);
                        }}
                        onKeyDown={(e) => {
                          if (move(r, c, e.key)) e.preventDefault();
                        }}
                      />
                    </td>
                  ))}
                  <td className="dl-grade-mean">
                    {nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="dl-grade-summary">
        <span>
          <strong>{summary.length}</strong> შევსებული უჯრა
        </span>
        <span>
          <strong>
            {summary.length
              ? (summary.reduce((a, b) => a + b, 0) / summary.length).toFixed(1)
              : '—'}
          </strong>{' '}
          ნიმუშის საშუალო
        </span>
        <button
          onClick={() => {
            setValues({});
            setChanged(false);
            notify('ნიმუში საწყის მდგომარეობას დაუბრუნდა');
          }}
        >
          <RotateCcw size={14} /> საწყისი ნიმუში
        </button>
      </div>
      <div className="dl-grade-help">
        <span>
          <Kbd>↑ ↓ ← →</Kbd> გადაადგილება <Kbd>↵</Kbd> შემდეგი მოსწავლე
        </span>
        <p>შეფასებები გამოგონილია. ცვლილებები გვერდის დატოვებისას იკარგება.</p>
      </div>
    </div>
  );
}
function UsersHeader() {
  return <span aria-hidden="true">№</span>;
}
