import { AttendancePulse } from '../components/AttendancePulse';
import { TimetableRhythm } from '../components/TimetableRhythm';
import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ArrowUpRight, CalendarDays, Check, UsersRound, BookOpen } from 'lucide-react';
import type { FoundationOverview, Viewer, Announcement, AgendaItem } from '../../shared/contracts';
import { api } from '../lib/api';
import { dateLabel } from '../lib/format';
import { Avatar, Skeleton, ErrorState, Modal, EmptyState } from '../components/ui';

export function Dashboard() {
  const { viewer } = useOutletContext<{ viewer: Viewer }>();
  const result = useQuery({
    queryKey: ['overview', viewer.id],
    queryFn: () => api<FoundationOverview>('/api/foundation/overview'),
  });
  const [notice, setNotice] = useState<Announcement | null>(null);
  const [event, setEvent] = useState<AgendaItem | null>(null);
  const [child, setChild] = useState<string | null>(null);
  if (result.isPending)
    return (
      <div className="product-dashboard dashboard-loading">
        <span className="product-eyebrow">თქვენი სივრცე იტვირთება</span>
        <Skeleton rows={5} />
      </div>
    );
  if (result.isError)
    return (
      <div className="product-dashboard">
        <ErrorState onRetry={() => void result.refetch()} />
      </div>
    );
  const data = result.data;
  if (!data.demo)
    return (
      <div className="product-dashboard product-ready">
        {viewer.capabilities.some((c) => c.startsWith('attendance:')) && <AttendancePulse />}
        {viewer.capabilities.some((c) => c.startsWith('timetable:')) && <TimetableRhythm />}
      </div>
    );
  const parent = viewer.roles.includes('guardian');
  const pupil = viewer.roles.includes('student');
  const teacher = viewer.capabilities.includes('students:assigned');
  const selected = data.students.find((s) => s.id === child) ?? data.students[0];
  const [, month, day] = data.snapshotDate.split('-');
  const name = viewer.name.split(' ')[0];
  const nextMeeting = data.agenda.find((item) => item.kind === 'meeting');
  return (
    <div className="product-dashboard">
      <header className="overview-heading">
        <div>
          <span className="product-eyebrow">
            {parent
              ? 'ოჯახის სასკოლო სივრცე'
              : pupil
                ? 'შენი სასკოლო დღე'
                : teacher
                  ? 'მასწავლებლის სივრცე'
                  : 'სკოლის ერთიანი ხედვა'}
          </span>
          <h1 className="greeting">
            გამარჯობა,{' '}
            <span className="greeting-tail">
              {name}.<span className="presence-cursor" aria-hidden="true" />
            </span>
          </h1>
          <p>
            {parent
              ? 'თქვენი შვილების დღე — ყველაფერი მნიშვნელოვანი, ახლოს.'
              : pupil
                ? 'დღის გეგმა და ახალი შესაძლებლობები.'
                : teacher
                  ? 'გაკვეთილები, მოსწავლეები და დღის შემდეგი ნაბიჯი.'
                  : 'ადამიანები, დღის რიტმი და ყურადღების მთავარი აქცენტები.'}
          </p>
        </div>
        <Link to="/calendar" className="overview-date">
          <time dateTime={data.snapshotDate}>
            <b>{day}</b>
            <i>/</i>
            <b>{month}</b>
          </time>
          <span>
            {dateLabel(data.snapshotDate)}
            <ArrowUpRight size={14} />
          </span>
        </Link>
      </header>
      <div className="overview-context">
        <span>
          <i /> სადემონსტრაციო ხედვა
        </span>
        <p>გამოგონილი ადამიანები და სასწავლო მაგალითები</p>
        <span className="product-number">
          {data.academicYear}
          <span> / I სემესტრი</span>
        </span>
      </div>
      {data.school ? (
        <section className="overview-signals" aria-label="სკოლის მაჩვენებლები">
          <Signal value={data.school.students} label="მოსწავლე" note="სადემონსტრაციო სიაში" />
          <Signal value={data.school.sections} label="კლასი" note="მიმდინარე სასწავლო წელს" />
          <Signal value={data.school.teachers} label="მასწავლებელი" note="სადემონსტრაციო გუნდი" />
          <div className="overview-signal-note">
            <span>ერთი სკოლა.</span>
            <strong>საერთო ხედვა.</strong>
            <span className="product-number">AIA-GESS / {data.academicYear}</span>
          </div>
        </section>
      ) : parent ? (
        <div className="overview-children" aria-label="შვილის არჩევა">
          {data.students.map((s, i) => (
            <button key={s.id} aria-pressed={selected?.id === s.id} onClick={() => setChild(s.id)}>
              <Avatar name={s.name} color={i} />
              <span>
                <strong>{s.name}</strong>
                <small>{s.section} კლასი</small>
              </span>
              {selected?.id === s.id && <Check size={17} />}
            </button>
          ))}
        </div>
      ) : (
        <div className="overview-personal">
          <BookOpen size={21} />
          <div>
            <strong>
              {teacher ? `${data.totalStudents} მოსწავლე თქვენს კლასში` : 'შენი სასწავლო სივრცე'}
            </strong>
            <span>
              {teacher
                ? 'თქვენთვის ხელმისაწვდომი მოსწავლეები და განრიგის მაგალითი'
                : `${selected?.section ?? ''} კლასი · I სემესტრი`}
            </span>
          </div>
          <span className="product-number">{data.academicYear}</span>
        </div>
      )}
      <div className={`overview-core ${!data.school ? 'overview-personal-core' : ''}`}>
        <section className="overview-focus">
          <div className="overview-section-head">
            <span className="product-eyebrow">
              {parent || pupil ? 'სასწავლო ფოკუსი' : 'ყურადღების ცენტრში'}
            </span>
            <span className="product-number">{parent || pupil ? '01' : '01 — 03'}</span>
          </div>
          {parent || pupil ? (
            <>
              <h2 className="family-heading">
                {parent ? `${selected?.name ?? 'შვილი'} — მოკლე მიმოხილვა` : 'დღის სასწავლო გეგმა'}
              </h2>
              <div className="overview-learning">
                <span className="product-eyebrow">ქართული ენა · სასწავლო მაგალითი</span>
                <h3>
                  მოთხრობის კითხვა
                  <br />
                  და განხილვა
                </h3>
                <p>29 სექტემბერი · {selected?.section} კლასი</p>
              </div>
              <div className="overview-family-links">
                <Link to={selected ? `/students?student=${selected.id}` : '/students'}>
                  მოსწავლის მიმოხილვა <ArrowRight size={16} />
                </Link>
                <Link to="/academics">
                  სასწავლო პროცესი <ArrowUpRight size={16} />
                </Link>
              </div>
            </>
          ) : (
            <>
              <h2>
                მთავარი —<br />
                ერთი შეხედვით.
              </h2>
              <div className="overview-priorities">
                <Link to="/students">
                  <span className="product-number">01</span>
                  <div>
                    <strong>{teacher ? 'თქვენი მოსწავლეები' : 'მოსწავლეთა საერთო სია'}</strong>
                    <small>{data.totalStudents} ჩანაწერი · წვდომა თქვენი როლის მიხედვით</small>
                  </div>
                  <ArrowUpRight size={18} />
                </Link>
                <Link to="/academics">
                  <span className="product-number">02</span>
                  <div>
                    <strong>
                      {teacher ? 'გაკვეთილის სამუშაო სივრცე' : 'სასწავლო პროცესის მიმოხილვა'}
                    </strong>
                    <small>სასწავლო სტრუქტურა და მოქმედი კურსები</small>
                  </div>
                  <ArrowUpRight size={18} />
                </Link>
                <Link to="/calendar">
                  <span className="product-number">03</span>
                  <div>
                    <strong>დღის განრიგი და შეხვედრები</strong>
                    <small>{data.agenda.length} მოვლენა · საილუსტრაციო განრიგი</small>
                  </div>
                  <ArrowUpRight size={18} />
                </Link>
              </div>
            </>
          )}
          <footer>
            <span className="presence-dot" />{' '}
            {parent || pupil
              ? 'სასწავლო დავალება ნიმუშია; ოფიციალური ჩანაწერი არ იქმნება.'
              : 'მნიშვნელოვანი ინფორმაცია ერთიან სამუშაო სივრცეში.'}
          </footer>
        </section>
        <aside className="dashboard-aside">
          {data.school && <Distribution school={data.school} />}
          <section className="overview-next-meeting" aria-label="შემდეგი შეხვედრა">
            {nextMeeting ? (
              <NextMeeting meeting={nextMeeting} onOpen={setEvent} />
            ) : (
              <p className="overview-muted">ამ დღის განრიგში შეხვედრა არ არის.</p>
            )}
          </section>
        </aside>
      </div>
      {viewer.capabilities.some((c) => c.startsWith('timetable:')) && (
        <TimetableRhythm studentId={parent ? selected?.id : undefined} />
      )}
      {viewer.capabilities.some((c) => c.startsWith('attendance:')) && (
        <AttendancePulse studentId={parent ? selected?.id : undefined} />
      )}
      <div className="overview-bottom">
        <section className="overview-people">
          <div className="overview-section-head">
            <h2>
              {parent
                ? 'თქვენი შვილები'
                : pupil
                  ? 'მოსწავლის ბარათი'
                  : teacher
                    ? 'ჩემი მოსწავლეები'
                    : 'მოსწავლეთა მიმოხილვა'}
            </h2>
            <Link to="/students">
              ყველას ნახვა <ArrowRight size={14} />
            </Link>
          </div>
          <div className="overview-person-list">
            {data.students.slice(0, 4).map((s) => (
              <Link to={`/students?student=${s.id}`} key={s.id}>
                <Avatar name={s.name} />
                <span>
                  <strong>{s.name}</strong>
                  <small>{s.number}</small>
                </span>
                <span className="overview-section-label">{s.section ?? '—'}</span>
                <ArrowUpRight size={15} />
              </Link>
            ))}
          </div>
          {!data.students.length && (
            <EmptyState
              title="მოსწავლეები არ არის"
              description="ამ ანგარიშს ჯერ არ აქვს მოსწავლეებზე წვდომა."
            />
          )}
          <footer>
            <span className="product-number">
              {Math.min(data.students.length, 4)} / {data.totalStudents}
            </span>{' '}
            ჩანაწერი · წვდომა თქვენი როლის მიხედვით
          </footer>
        </section>
        <section className="overview-news">
          <div className="overview-section-head">
            <h2>სასკოლო ამბები</h2>
            <span className="product-number">
              {data.announcements.length.toString().padStart(2, '0')}
            </span>
          </div>
          {data.announcements.map((n) => (
            <button key={n.id} onClick={() => setNotice(n)}>
              <span className="overview-news-meta">
                {n.category}
                <time>{dateLabel(n.date)}</time>
              </span>
              <strong>{n.title}</strong>
              <span>
                განცხადების ნახვა <ArrowUpRight size={16} />
              </span>
            </button>
          ))}
          {!data.announcements.length && (
            <p className="overview-muted">ახალი განცხადება არ არის.</p>
          )}
        </section>
      </div>
      <Modal
        open={Boolean(notice)}
        onOpenChange={(open) => {
          if (!open) setNotice(null);
        }}
        title={notice?.title ?? ''}
        description={notice ? `${notice.category} · ${dateLabel(notice.date)}` : ''}
        themeClass="product-theme"
        className="product-context-dialog"
      >
        <p className="article-copy">{notice?.body}</p>
        <p className="overview-muted">სადემონსტრაციო განცხადება</p>
      </Modal>
      <Modal
        open={Boolean(event)}
        onOpenChange={(open) => {
          if (!open) setEvent(null);
        }}
        title={event?.title ?? ''}
        description={`${dateLabel(data.snapshotDate)} · საილუსტრაციო განრიგი`}
        themeClass="product-theme"
        className="product-context-dialog"
      >
        <span className="event-display-time product-number">{event?.time}</span>
        <p className="article-copy">{event?.detail}</p>
        <p className="overview-muted">
          ღონისძიება ნიმუშია. მონაწილეები და დასწრება აქ არ აღირიცხება.
        </p>
        <Link className="product-secondary" to="/calendar">
          კალენდრის გახსნა <CalendarDays size={16} />
        </Link>
      </Modal>
    </div>
  );
}
function NextMeeting({
  meeting,
  onOpen,
}: {
  meeting: AgendaItem;
  onOpen: (item: AgendaItem) => void;
}) {
  return (
    <>
      <div className="overview-meeting-time">
        <span>შემდეგი შეხვედრა</span>
        <time className="product-number">{meeting.time}</time>
      </div>
      <div className="overview-meeting-detail">
        <h3>{meeting.title}</h3>
        <p>{meeting.detail}</p>
        <button onClick={() => onOpen(meeting)}>
          დეტალები <ArrowRight size={15} />
        </button>
      </div>
    </>
  );
}
function Signal({ value, label, note }: { value: number; label: string; note: string }) {
  return (
    <div className="overview-signal">
      <strong className="product-number">{String(value).padStart(2, '0')}</strong>
      <span>
        {label}
        <small>{note}</small>
      </span>
    </div>
  );
}
function Distribution({ school }: { school: NonNullable<FoundationOverview['school']> }) {
  const circumference = 2 * Math.PI * 58;
  let cumulative = 0;
  return (
    <section className="overview-distribution">
      <div className="overview-section-head">
        <h2>მოსწავლეთა განაწილება</h2>
        <UsersRound size={16} />
      </div>
      <div className="overview-distribution-body">
        <div className="overview-ring">
          <svg viewBox="0 0 144 144" aria-hidden="true">
            <circle className="ring-track" cx="72" cy="72" r="58" />
            {school.gradeDistribution.map((g, i) => {
              const length = school.students ? (g.students / school.students) * circumference : 0;
              const offset = cumulative;
              cumulative += length;
              return (
                <circle
                  key={g.grade}
                  cx="72"
                  cy="72"
                  r="58"
                  className={`ring-segment segment-${i}`}
                  strokeDasharray={`${Math.max(0, length - 4)} ${circumference}`}
                  strokeDashoffset={-offset}
                />
              );
            })}
          </svg>
          <div>
            <strong className="product-number">{school.students}</strong>
            <span>მოსწავლე</span>
          </div>
        </div>
        <ul>
          {school.gradeDistribution.map((g, i) => (
            <li key={g.grade}>
              <i className={`segment-${i}`} />
              <span>{g.grade} კლასი</span>
              <strong className="product-number">{String(g.students).padStart(2, '0')}</strong>
            </li>
          ))}
        </ul>
      </div>
      <footer>აქტიური ჩარიცხვები · სადემონსტრაციო სია</footer>
    </section>
  );
}
