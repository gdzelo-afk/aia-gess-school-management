import { useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Eye,
  EyeOff,
  Pause,
  Play,
  RotateCcw,
  ScanLine,
  CircleDot,
  MoveUpRight,
} from 'lucide-react';
import { directions, sections, people, agenda, priorities } from './data';
import { Mark } from './primitives';
import type { LabActions } from './DesignLab';
export function Login({ direction, notify }: LabActions) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [paused, setPaused] = useState(false);
  const [replay, setReplay] = useState(0);
  const navigate = useNavigate();
  const texts =
    direction === 'a'
      ? ['სივრცე', 'მომავლისთვის.']
      : direction === 'b'
        ? ['იფიქრე მკაფიოდ.', 'იმოქმედე ზუსტად.']
        : ['დღეს იწყება', 'შემდეგი.'];
  return (
    <main className={`dl-login ${paused ? 'dl-paused' : ''}`}>
      <section className="dl-login-stage">
        <Mark />
        <div className="dl-login-art" aria-hidden="true" key={replay}>
          {direction === 'a' ? (
            <div className="dl-lens">
              <i />
              <i />
              <i />
              <i />
              <div />
              <span>ა</span>
            </div>
          ) : direction === 'b' ? (
            <>
              <div className="dl-coordinates">
                <span>41°43′ N</span>
                <span>44°47′ E</span>
              </div>
              <svg viewBox="0 0 600 500">
                <path d="M20 400H150V300H260V200H370V100H580" />
                <path d="M20 450H200V350H310V250H420V150H580" />
                <path d="M20 350H100V250H210V150H320V50H580" />
                <circle cx="370" cy="100" r="9" />
              </svg>
              <span className="dl-login-digits">
                28<span>/09</span>
              </span>
            </>
          ) : (
            <div className="dl-type-sculpture">
              <span>ა</span>
              <span>ი</span>
              <span>ა</span>
              <i />
            </div>
          )}
        </div>
        <div className="dl-login-statement" key={`type-${replay}`}>
          <span className="dl-eyebrow">{directions[direction].subtitle}</span>
          <h1>
            {texts.map((t, i) => (
              <span key={t} style={{ '--i': i } as CSSProperties}>
                <b>{t}</b>
              </span>
            ))}
          </h1>
          <p>
            ადამიანები, ცოდნა და გადაწყვეტილებები.
            <br />
            სკოლის შემდეგი თავი — ერთ სივრცეში.
          </p>
        </div>
        <footer>
          <span>თბილისი, საქართველო</span>
          <div>
            <button
              aria-label={paused ? 'ანიმაციის გაგრძელება' : 'ანიმაციის შეჩერება'}
              onClick={() => setPaused(!paused)}
            >
              {paused ? <Play size={15} /> : <Pause size={15} />}
            </button>
            <button aria-label="ანიმაციის გამეორება" onClick={() => setReplay((x) => x + 1)}>
              <RotateCcw size={15} />
            </button>
            <span>{direction === 'a' ? '01' : direction === 'b' ? '02' : '03'} / 03</span>
          </div>
        </footer>
      </section>
      <section className="dl-login-form">
        <div className="dl-login-form-inner">
          <div className="dl-entry-label">
            <span>
              {direction.toUpperCase()} / {directions[direction].name}
            </span>
            <ScanLine size={22} />
          </div>
          <h2>
            თქვენი სამუშაო
            <br />
            სივრცე.
          </h2>
          <p>კეთილი იყოს თქვენი დაბრუნება.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              await new Promise((r) => setTimeout(r, 450));
              navigate(`/design-lab/${direction}/dashboard`);
            }}
          >
            <label>
              ელფოსტა
              <input
                type="email"
                required
                defaultValue="director@demo.aia.local"
                autoComplete="off"
              />
            </label>
            <label>
              პაროლი
              <span className="dl-password">
                <input
                  type={visible ? 'text' : 'password'}
                  required
                  minLength={4}
                  defaultValue="demo2026"
                  autoComplete="off"
                />
                <button
                  type="button"
                  aria-label={visible ? 'პაროლის დამალვა' : 'პაროლის ჩვენება'}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>
            <div className="dl-form-options">
              <label>
                <input type="checkbox" defaultChecked /> დამიმახსოვრე ამ ნიმუშში
              </label>
              <button
                type="button"
                onClick={() => notify('აღდგენის პროცესი ამ ვიზუალურ კვლევაში არ არის ჩართული')}
              >
                პაროლის აღდგენა
              </button>
            </div>
            <button className="dl-primary" disabled={busy}>
              {busy ? 'სივრცე იხსნება…' : 'სივრცეში შესვლა'}
              {busy ? <span className="dl-spinner" /> : <ArrowRight size={18} />}
            </button>
          </form>
          <div className="dl-login-disclaimer">
            <CircleDot size={16} />
            <p>
              ვიზუალური შესვლის ნიმუში. გამოიყენეთ შევსებული გამოგონილი მონაცემები. ანგარიში და
              სესია არ იქმნება.
            </p>
          </div>
        </div>
        <div className="dl-login-form-footer">
          <span>დიზაინის ლაბორატორია</span>
          <Link to={`/design-lab/${direction}/dashboard`}>
            პირდაპირ ნახვა <ArrowUpRight size={14} />
          </Link>
        </div>
      </section>
    </main>
  );
}
function Signals({ direction }: Pick<LabActions, 'direction'>) {
  return (
    <div className="dl-signals">
      {[
        { value: people.length, label: 'მოსწავლე', detail: 'გამოგონილი სია', route: 'students' },
        { value: sections.length, label: 'კლასი', detail: 'VII–IX საფეხური', route: 'students' },
        { value: 2, label: 'მასწავლებელი', detail: 'საილუსტრაციო გუნდი', route: 'gradebook' },
      ].map((s, i) => (
        <Link key={s.label} to={`/design-lab/${direction}/${s.route}`}>
          <span className="dl-signal-index">0{i + 1}</span>
          <strong>{String(s.value).padStart(2, '0')}</strong>
          <span>
            {s.label}
            <small>{s.detail}</small>
          </span>
          <ArrowUpRight size={17} />
        </Link>
      ))}
    </div>
  );
}
function PriorityList({ direction, openModal }: LabActions) {
  const navigate = useNavigate();
  return (
    <div className="dl-priorities">
      {priorities.map((p, i) => (
        <button
          key={p.title}
          onClick={() =>
            p.route === 'meeting'
              ? openModal('meeting')
              : navigate(`/design-lab/${direction}/${p.route}`)
          }
        >
          <span className="dl-priority-index">{String(i + 1).padStart(2, '0')}</span>
          <span>
            <strong>{p.title}</strong>
            <small>{p.detail}</small>
          </span>
          <span className="dl-priority-time">{p.time}</span>
          <ArrowUpRight size={18} />
        </button>
      ))}
    </div>
  );
}
function Schedule({ openModal }: LabActions) {
  return (
    <div className="dl-schedule">
      {agenda.map((a, i) => (
        <button onClick={() => openModal('meeting', i)} key={a.time}>
          <time>
            {a.time}
            <small>{a.end}</small>
          </time>
          <i className={i === 1 ? 'active' : ''} />
          <span>
            <strong>{a.title}</strong>
            <small>{a.detail}</small>
          </span>
          <ChevronRight size={15} />
        </button>
      ))}
    </div>
  );
}
function Distribution({ direction }: { direction: LabActions['direction'] }) {
  const [hover, setHover] = useState<number | null>(null);
  const counts = sections.map((s) => people.filter((p) => p.section === s).length);
  return (
    <div className="dl-distribution">
      <div className="dl-chart-title">
        <h3>მოსწავლეთა განაწილება</h3>
        <span>12 მოსწავლე · 4 კლასი</span>
      </div>
      {direction === 'a' ? (
        <div className="dl-ring-layout">
          <div className="dl-ring">
            <svg
              viewBox="0 0 180 180"
              role="img"
              aria-label="თითოეულ კლასში 3 გამოგონილი მოსწავლეა"
            >
              <circle cx="90" cy="90" r="70" className="dl-ring-track" />
              {counts.map((n, i) => (
                <circle
                  key={i}
                  cx="90"
                  cy="90"
                  r="70"
                  strokeDasharray={`${(n / 12) * 439.8 - 5} 439.8`}
                  strokeDashoffset={-i * 109.95}
                  transform="rotate(-90 90 90)"
                  className={`segment-${i}`}
                  style={{ opacity: hover === null || hover === i ? 1 : 0.3 }}
                />
              ))}
            </svg>
            <div>
              <strong>{hover === null ? '12' : '03'}</strong>
              <small>{hover === null ? 'მოსწავლე' : sections[hover]}</small>
            </div>
          </div>
          <div className="dl-chart-legend">
            {sections.map((s, i) => (
              <Link
                key={s}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                to={`/design-lab/${direction}/students?section=${encodeURIComponent(s)}`}
              >
                <i className={`segment-${i}`} />
                {s}
                <strong>03</strong>
                <ArrowUpRight size={13} />
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="dl-bar-chart">
          {sections.map((s, i) => (
            <Link to={`/design-lab/${direction}/students?section=${encodeURIComponent(s)}`} key={s}>
              <span>{s}</span>
              <div>
                {[0, 1, 2].map((n) => (
                  <i key={n} style={{ '--i': i * 3 + n } as CSSProperties} />
                ))}
              </div>
              <strong>03</strong>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
export function Dashboard(props: LabActions) {
  if (props.direction === 'a') return <DashboardA {...props} />;
  if (props.direction === 'b') return <DashboardB {...props} />;
  return <DashboardC {...props} />;
}
function DashboardA(props: LabActions) {
  return (
    <div className="dl-dashboard-a">
      <div className="dl-page-heading">
        <div>
          <span className="dl-eyebrow">ორშაბათი, 28 სექტემბერი</span>
          <h1>დილა მშვიდობისა, თამარ.</h1>
          <p>სკოლის დღე, მკაფიო პერსპექტივაში.</p>
        </div>
        <button className="dl-button" onClick={() => props.openModal('meeting')}>
          <CalendarDays size={17} /> დღის განრიგი
        </button>
      </div>
      <Signals direction="a" />
      <div className="dl-a-composition">
        <section className="dl-focus-surface">
          <div className="dl-focus-heading">
            <span className="dl-eyebrow">
              <i /> ყურადღების ცენტრში
            </span>
            <span className="dl-focus-count">03</span>
          </div>
          <h2>
            მთავარი —<br />
            ერთი შეხედვით.
          </h2>
          <p>დღის სამი სამუშაო აქცენტი.</p>
          <PriorityList {...props} />
          <footer>
            <Check size={14} /> საილუსტრაციო სამუშაო ნაკადი <ArrowRight size={15} />
          </footer>
        </section>
        <div className="dl-a-side">
          <Distribution direction="a" />
          <div className="dl-day-note">
            <div>
              <span className="dl-eyebrow">შემდეგი შეხვედრა</span>
              <strong>11:30</strong>
            </div>
            <div>
              <h3>აკადემიური გუნდი</h3>
              <p>კვირის საერთო ხედვა</p>
              <button onClick={() => props.openModal('meeting')}>
                დეტალები <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>
      <section className="dl-agenda-section">
        <div className="dl-section-title">
          <h2>დღის რიტმი</h2>
          <span>
            <Clock3 size={14} /> თბილისის დრო
          </span>
        </div>
        <Schedule {...props} />
      </section>
    </div>
  );
}
function DashboardB(props: LabActions) {
  return (
    <div className="dl-dashboard-b">
      <div className="dl-b-heading">
        <div>
          <span className="dl-eyebrow">დირექტორის სამუშაო პანელი</span>
          <h1>
            დღის კონტროლი
            <span className="dl-cursor" />
          </h1>
        </div>
        <div className="dl-b-date">
          <strong>28.09</strong>
          <span>ორშაბათი / 2026</span>
        </div>
      </div>
      <Signals direction="b" />
      <div className="dl-console">
        <section>
          <div className="dl-section-title">
            <h2>
              <CircleDot size={15} /> სამუშაო რიგი
            </h2>
            <span>03 ამოცანა</span>
          </div>
          <PriorityList {...props} />
          <div className="dl-console-note">
            <span>კონტექსტი</span>
            <p>პროფილების გადამოწმების შემდეგ გადადით კვირის აკადემიურ მიმოხილვაზე.</p>
            <Link to="/design-lab/b/students?status=review">
              გადასამოწმებელი სია <MoveUpRight size={16} />
            </Link>
          </div>
        </section>
        <section className="dl-b-timeline">
          <div className="dl-section-title">
            <h2>დღის დროითი ხაზი</h2>
            <span>28 სექტემბერი</span>
          </div>
          <div className="dl-timeline-ruler">
            <span>09:00</span>
            <span>11:00</span>
            <span>13:00</span>
            <span>15:00</span>
            <span>17:00</span>
          </div>
          {agenda.map((a, i) => (
            <button
              key={a.time}
              onClick={() => props.openModal('meeting', i)}
              className="dl-timeband"
              style={
                {
                  '--offset': `${((Number(a.time.slice(0, 2)) * 60 + Number(a.time.slice(3)) - 540) / 480) * 100}%`,
                  '--length': `${((Number(a.end.slice(0, 2)) * 60 + Number(a.end.slice(3)) - (Number(a.time.slice(0, 2)) * 60 + Number(a.time.slice(3)))) / 480) * 100}%`,
                } as CSSProperties
              }
            >
              <i className="dl-timeband-marker" aria-hidden="true" />
              <span>
                {a.time} — {a.end}
              </span>
              <strong>{a.title}</strong>
              <small>{a.detail}</small>
            </button>
          ))}
          <div className="dl-timeline-caption">
            <i /> ფიქსირებული სადემონსტრაციო დღე
          </div>
        </section>
      </div>
      <div className="dl-b-bottom">
        <Distribution direction="b" />
        <section>
          <div className="dl-section-title">
            <h2>სამუშაო სივრცის სია</h2>
            <Link to="/design-lab/b/students">
              ყველა <ArrowUpRight size={14} />
            </Link>
          </div>
          {people.slice(0, 3).map((p) => (
            <Link
              className="dl-mini-person"
              to={`/design-lab/b/students?person=${p.id}`}
              key={p.id}
            >
              <span>{p.id}</span>
              <strong>{p.name}</strong>
              <span>{p.section}</span>
              <ArrowUpRight size={14} />
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}
function DashboardC(props: LabActions) {
  return (
    <div className="dl-dashboard-c">
      <div className="dl-c-masthead">
        <div>
          <span className="dl-eyebrow">ორშაბათი / სექტემბერი 2026</span>
          <h1>
            სკოლა
            <br />
            <span>მოძრაობაში.</span>
          </h1>
        </div>
        <div className="dl-c-date">
          <strong>28</strong>
          <span>
            სექტემბერი
            <ArrowUpRight size={24} />
          </span>
        </div>
      </div>
      <div className="dl-c-intro">
        <span>დღის გამოცემა / 001</span>
        <p>
          გამარჯობა, თამარ.
          <br />
          დღეს ყურადღება ადამიანებზეა.
        </p>
        <Link to="/design-lab/c/students">
          მოსწავლეთა სივრცე <ArrowRight size={20} />
        </Link>
      </div>
      <div className="dl-c-body">
        <section className="dl-c-priorities">
          <div className="dl-section-title">
            <h2>მთავარი აქცენტები</h2>
            <span>01—03</span>
          </div>
          <PriorityList {...props} />
        </section>
        <section className="dl-c-data">
          <Signals direction="c" />
          <Distribution direction="c" />
        </section>
      </div>
      <section className="dl-c-agenda">
        <div className="dl-section-title">
          <h2>დღე, საათებად.</h2>
          <button onClick={() => props.openModal('meeting')}>
            განრიგის ნახვა <ArrowUpRight size={17} />
          </button>
        </div>
        <Schedule {...props} />
      </section>
    </div>
  );
}
