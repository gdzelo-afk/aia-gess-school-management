import { useState } from 'react';
import { useLocation, useOutletContext, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  ArrowRight,
  Check,
  FileText,
  Download,
  Palette,
  Monitor,
  ShieldCheck,
} from 'lucide-react';
import type { Viewer, FoundationOverview } from '../../shared/contracts';
import { roleLabels } from '../../shared/contracts';
import { api } from '../lib/api';
import { usePreferences } from '../lib/preferences';
import { navigation } from '../components/navigation';
import {
  Button,
  Badge,
  Card,
  SectionHeading,
  Modal,
  EmptyState,
  ErrorState,
  Skeleton,
  useToast,
  Avatar,
} from '../components/ui';
export function Settings() {
  const { viewer } = useOutletContext<{ viewer: Viewer }>();
  const { theme, setTheme, compact, setCompact } = usePreferences();
  const toast = useToast();
  const [draftTheme, setDraftTheme] = useState(theme);
  const [dense, setDense] = useState(compact);
  return (
    <>
      <PageTitle
        kicker="თქვენი სივრცე"
        title="პარამეტრები"
        description="მოირგეთ სამუშაო გარემო თქვენს ყოველდღიურობაზე."
      />
      <div className="settings-layout">
        <Card>
          <SectionHeading title="გარეგნობა">
            <Palette size={20} />
          </SectionHeading>
          <form
            className="settings-form"
            onSubmit={(e) => {
              e.preventDefault();
              setTheme(draftTheme);
              setCompact(dense);
              toast('პარამეტრები შენახულია ამ მოწყობილობაზე.');
            }}
          >
            <fieldset>
              <legend>ფერის რეჟიმი</legend>
              <div className="theme-options">
                {(['light', 'dark'] as const).map((t) => (
                  <label key={t} className={`theme-option ${draftTheme === t ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="theme"
                      value={t}
                      checked={draftTheme === t}
                      onChange={() => setDraftTheme(t)}
                    />
                    <span className={`theme-preview preview-${t}`}>
                      <i />
                      <span>
                        <b />
                        <b />
                        <b />
                      </span>
                    </span>
                    <span>
                      {t === 'light' ? 'ღია' : 'მუქი'} რეჟიმი
                      {draftTheme === t && <Check size={16} />}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="switch-row">
              <span>
                <strong>კომპაქტური ცხრილები</strong>
                <small>უფრო მეტი ჩანაწერი სამუშაო ეკრანზე.</small>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={dense}
                onChange={(e) => setDense(e.target.checked)}
              />
            </label>
            <div className="settings-save">
              <p>ცვლილებები ინახება მხოლოდ ამ ბრაუზერში.</p>
              <Button variant="primary" type="submit">
                ცვლილებების შენახვა
              </Button>
            </div>
          </form>
        </Card>
        <div>
          <Card className="account-card">
            <SectionHeading title="თქვენი ანგარიში">
              <ShieldCheck size={18} />
            </SectionHeading>
            <Avatar name={viewer.name} />
            <h3>{viewer.name}</h3>
            <div className="role-badges">
              {viewer.roles.map((r) => (
                <Badge key={r}>{roleLabels[r]}</Badge>
              ))}
            </div>
            <p>როლები და წვდომა იმართება ადმინისტრატორის მიერ.</p>
          </Card>
          <div className="privacy-caption">
            <Monitor size={16} />
            <p>
              ენა: ქართული
              <br />
              დროის სარტყელი: თბილისი
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
export function Calendar() {
  const { viewer } = useOutletContext<{ viewer: Viewer }>();
  const result = useQuery({
    queryKey: ['overview', viewer.id],
    queryFn: () => api<FoundationOverview>('/api/foundation/overview'),
  });
  const [day, setDay] = useState('2026-09-28');
  return (
    <>
      <PageTitle
        kicker="სასწავლო კვირა"
        title="კალენდარი"
        description="მნიშვნელოვანი შეხვედრები და სასკოლო მოვლენები."
      />
      <Card>
        <div className="calendar-header">
          <h2>დღის განრიგი</h2>
          <label className="field inline-field">
            თარიღი
            <input
              aria-label="თარიღი"
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </label>
        </div>
        {result.isPending ? (
          <Skeleton />
        ) : result.isError ? (
          <ErrorState onRetry={() => void result.refetch()} />
        ) : day !== '2026-09-28' || !result.data.agenda.length ? (
          <EmptyState
            title="ამ დღეს ღონისძიება არ არის"
            description="სადემონსტრაციო განრიგი ხელმისაწვდომია 28 სექტემბრისთვის."
            action={<Button onClick={() => setDay('2026-09-28')}>28 სექტემბრის ნახვა</Button>}
          />
        ) : (
          result.data.agenda.map((a) => (
            <article className="calendar-event" key={a.id}>
              <time>{a.time}</time>
              <span className={`event-symbol kind-${a.kind}`}>
                <CalendarDays size={21} />
              </span>
              <div>
                <h3>{a.title}</h3>
                <p>{a.detail}</p>
              </div>
              <Badge>ნიმუში</Badge>
            </article>
          ))
        )}
        <p className="calendar-disclaimer">
          ღონისძიებებისა და ცხრილის მართვა დაგეგმილია მომდევნო ეტაპზე.
        </p>
      </Card>
    </>
  );
}
export function PlannedPage() {
  const { viewer } = useOutletContext<{ viewer: Viewer }>();
  const { pathname } = useLocation();
  const item = navigation(viewer).find((n) => n.path === pathname);
  const descriptions: Record<string, string> = {
    '/academics': 'გაკვეთილები, დასწრება, შეფასებები და დავალებები ერთიან სამუშაო სივრცეში.',
    '/finance': 'სწავლის საფასური, ინვოისები და გადახდები შესაბამისი წვდომით.',
    '/reports': 'მნიშვნელოვანი მონაცემების მკაფიო ხედვა და დასაბუთებული გადაწყვეტილებები.',
    '/messages': 'სკოლის, მასწავლებლებისა და ოჯახების ყოველდღიური კავშირი.',
    '/community': 'კლუბები, ღონისძიებები და მოსწავლეთა მიღწევები.',
  };
  return (
    <>
      <PageTitle
        kicker="სასკოლო სივრცე"
        title={item?.label ?? 'გვერდი მიუწვდომელია'}
        description={descriptions[pathname] ?? 'ამ გვერდზე წვდომა არ გაქვთ ან მისამართი არასწორია.'}
      />
      <Card>
        <EmptyState
          denied={!item}
          title={item ? 'ეს სივრცე მზადების პროცესშია' : 'გვერდი მიუწვდომელია'}
          description={
            item
              ? 'ამ ეტაპზე შეგიძლიათ გაეცნოთ სამუშაო გარემოს, მოსწავლეთა ნიმუშებსა და კალენდარს. მოდულის ფუნქციები შემდეგ ეტაპზე დაემატება.'
              : 'შეამოწმეთ მისამართი ან დაბრუნდით მთავარ გვერდზე.'
          }
          action={
            <Link className="button button-primary" to="/">
              მიმოხილვაზე დაბრუნება
              <ArrowRight size={16} />
            </Link>
          }
        />
      </Card>
    </>
  );
}
export function DesignGallery() {
  const [dialog, setDialog] = useState(false);
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const toast = useToast();
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  return (
    <>
      <PageTitle
        kicker="ინტერფეისის საფუძველი"
        title="დიზაინის სისტემა"
        description="თანმიმდევრული კომპონენტები, მკაფიო მდგომარეობები და ქართული ტიპოგრაფია."
      />
      <a className="product-secondary lab-archive-link" href="/design-lab">
        ვიზუალური ლაბორატორია · A / B / C არქივი <ArrowRight size={16} />
      </a>
      <div className="gallery-grid">
        <Card>
          <SectionHeading title="მოქმედებები და სტატუსები" />
          <div className="component-row">
            <Button variant="primary" onClick={() => toast('მოქმედების უკუკავშირის მაგალითი.')}>
              <Check size={16} />
              დადასტურება
            </Button>
            <Button onClick={() => setDialog(true)}>დიალოგის გახსნა</Button>
            <Button disabled>მიუწვდომელია</Button>
          </div>
          <div className="component-row">
            <Badge tone="success">აქტიური</Badge>
            <Badge tone="warning">გადასამოწმებელი</Badge>
            <Badge>მონახაზი</Badge>
            <Avatar name="თამარ ჯაფარიძე" />
          </div>
        </Card>
        <Card>
          <SectionHeading title="ფორმა და ვალიდაცია" />
          <form
            className="sample-form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(true);
              if (valid) toast('ფორმა შემოწმებულია. მონაცემები არ გაგზავნილა.');
            }}
          >
            <label className="field">
              საკონტაქტო ელფოსტა
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={submitted && !valid}
                aria-describedby="email-hint"
                placeholder="მაგალითი@სკოლა.ge"
              />
            </label>
            <p id="email-hint" className={submitted && !valid ? 'field-error' : 'fine-print'}>
              {submitted && !valid
                ? 'შეიყვანეთ სწორი ელფოსტის მისამართი.'
                : 'ფორმის ვიზუალური მაგალითი; მონაცემები არ იგზავნება.'}
            </p>
            <Button type="submit">შემოწმება</Button>
          </form>
        </Card>
        <Card>
          <SectionHeading title="ცარიელი მდგომარეობა" />
          <EmptyState
            title="დოკუმენტები ჯერ არ არის"
            description="დამატებული ფაილები აქ გამოჩნდება."
          />
        </Card>
        <Card>
          <SectionHeading title="ჩატვირთვის მდგომარეობა" />
          <Skeleton rows={3} />
        </Card>
        <Card>
          <SectionHeading title="დოკუმენტის ბარათი" />
          <div className="file-card">
            <FileText size={28} />
            <div>
              <strong>სემესტრის მიმოხილვა.pdf</strong>
              <small>ნიმუში · 240 კბ · ვერსია 1</small>
            </div>
            <Button disabled aria-label="ჩამოტვირთვა ჯერ მიუწვდომელია">
              <Download size={16} />
            </Button>
          </div>
        </Card>
        <Card>
          <SectionHeading title="შეზღუდული წვდომა" />
          <EmptyState
            denied
            title="წვდომა შეზღუდულია"
            description="ამ მონაცემებს მხოლოდ შესაბამისი როლის მქონე პირი ხედავს."
          />
        </Card>
        <Card>
          <SectionHeading title="კავშირის შეცდომა" />
          <ErrorState onRetry={() => toast('განმეორებითი მცდელობის ვიზუალური მაგალითი.')} />
        </Card>
      </div>
      <Modal
        open={dialog}
        onOpenChange={setDialog}
        title="წაიშალოს მონახაზი?"
        description="დადასტურების ვიზუალური მაგალითი. რეალური ჩანაწერი არ წაიშლება."
      >
        <div className="dialog-actions">
          <Button onClick={() => setDialog(false)}>გაუქმება</Button>
          <Button
            variant="danger"
            onClick={() => {
              setDialog(false);
              toast('დადასტურების მაგალითი დასრულებულია.');
            }}
          >
            მონახაზის წაშლა
          </Button>
        </div>
      </Modal>
    </>
  );
}
function PageTitle({
  kicker,
  title,
  description,
}: {
  kicker: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-intro">
      <div>
        <div className="page-kicker">{kicker}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </div>
  );
}
