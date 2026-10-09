import { DateInput } from '../DateInput';
import { Select } from '../Select';
import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Modal } from '../ui';
import { api } from '../../lib/api';
import { dateLabel } from '../../lib/format';
import { tbilisiDate } from '../../lib/semester';
import { categoryLabels, currentAssessmentPolicy } from '../../../shared/gradebook';
import { command, errorText, type Setup, type Criteria, type Journal } from './model';

export function CreateAssessment({
  setup,
  yearId,
  semesterId,
  offeringId,
  onClose,
  onCreated,
}: {
  setup: Setup;
  yearId: string;
  semesterId: string;
  offeringId: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [offer, setOffer] = useState(
      offeringId || setup.offerings.find((o) => o.writable)?.id || '',
    ),
    [group, setGroup] = useState(''),
    [date, setDate] = useState(tbilisiDate()),
    [category, setCategory] = useState<'classwork' | 'homework' | 'summative'>('classwork'),
    [formative, setFormative] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const course = setup.offerings.find((o) => o.id === offer);
  const effectiveFormative =
    formative ||
    course?.policy?.resolved.mode === 'formative_only' ||
    (!!course?.policy && !course.policy.resolved.categories.includes(category));
  const criteria = useQuery({
    queryKey: ['gradebook', 'criteria-list', yearId, course?.subjectId],
    queryFn: () =>
      api<Criteria>(`/api/gradebook/criteria?yearId=${yearId}&subjectId=${course!.subjectId}`),
    enabled: !!course,
  });
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const g = setup.groups.find((g) => `${g.versionId}:${g.id}` === group);
      const x = await command({
        action: 'assessment.create',
        scope: g
          ? { kind: 'group', versionId: g.versionId, groupId: g.id }
          : { kind: 'offering', offeringId: offer },
        semesterId,
        date,
        title: f.get('title'),
        category,
        formative: effectiveFormative,
        description: f.get('description'),
        activity: '',
        criteriaId: category === 'summative' ? f.get('criteria') || null : null,
      });
      onCreated(x.id);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onOpenChange={onClose}
      title="ახალი შეფასება"
      description="შექმენით პირადი მონახაზი. შედეგები მხოლოდ თქვენი გამოქვეყნების შემდეგ გამოჩნდება."
      className="gb-modal"
    >
      <form onSubmit={submit} className="gb-form">
        <label className="gb-field">
          კურსი
          <Select
            required
            value={offer}
            onChange={(e) => {
              setOffer(e.target.value);
              setGroup('');
            }}
          >
            {setup.offerings
              .filter((o) => o.writable)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.section} · {o.subject}
                </option>
              ))}
          </Select>
        </label>
        <label className="gb-field">
          ჯგუფი
          <Select value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="">კურსის სრული სია</option>
            {setup.groups
              .filter((g) => g.offeringIds.includes(offer) && g.startsOn <= date && date < g.endsOn)
              .map((g) => (
                <option key={`${g.versionId}:${g.id}`} value={`${g.versionId}:${g.id}`}>
                  {g.name}
                </option>
              ))}
          </Select>
        </label>
        <label className="gb-field">
          დასახელება
          <input
            name="title"
            required
            minLength={2}
            maxLength={180}
            placeholder="მაგ. ტექსტის ანალიზი"
          />
        </label>
        <div className="gb-form-pair">
          <label className="gb-field">
            თარიღი
            <DateInput
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="gb-field">
            კატეგორია
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
            >
              {Object.entries(categoryLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <label className="gb-checkbox">
          <input
            type="checkbox"
            checked={effectiveFormative}
            disabled={
              course?.policy?.resolved.mode === 'formative_only' ||
              (!!course?.policy && !course.policy.resolved.categories.includes(category))
            }
            onChange={(e) => setFormative(e.target.checked)}
          />{' '}
          განმავითარებელი შეფასება · ქულის გარეშე
        </label>
        {category === 'summative' && (
          <label className="gb-field">
            დამტკიცებული კრიტერიუმი
            <Select name="criteria">
              <option value="">კრიტერიუმის გარეშე</option>
              {criteria.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  ვერსია {c.revision} · {dateLabel(c.approvedAt.slice(0, 10))}
                </option>
              ))}
            </Select>
          </label>
        )}
        <label className="gb-field">
          აღწერა
          <textarea name="description" maxLength={2000} />
        </label>
        <p className="gb-muted">
          {effectiveFormative
            ? 'ამ შეფასებაში ქულა არ გამოიყენება. შეიტანეთ განმავითარებელი უკუკავშირი.'
            : course?.policy?.resolved.mode === 'pass_fail'
              ? 'ჩათვლა / არჩათვლა · არ შედის რიცხვით საშუალოში.'
              : '1–10 · მხოლოდ მთელი ქულა. შეუფასებელი შედეგი ნული არ არის.'}
        </p>
        <div className="ux-feedback-slot">
          {error && (
            <p className="gb-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <Button type="submit" variant="primary" disabled={busy || !course?.policy}>
          მონახაზის შექმნა
        </Button>
        {!course?.policy && <p>ჯერ საჭიროა კურსის შეფასების წესის განსაზღვრა.</p>}
      </form>
    </Modal>
  );
}
export function WritingForm({
  data,
  yearId,
  offeringId,
  homeroom,
  canTeach,
  onClose,
  onSaved,
}: {
  data: Journal;
  yearId: string;
  offeringId: string;
  homeroom: boolean;
  canTeach: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState(canTeach ? 'guardian_note' : 'homeroom_note'),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState<{ id: string; revision: number } | null>(null);
  return (
    <Modal
      open
      onOpenChange={() => {
        if (!dirty || saved || window.confirm('შეუნახავი ცვლილებები დაიკარგება. გაგრძელება?'))
          onClose();
      }}
      title="აკადემიური ჩანაწერი"
      description="წლიური შეფასება მოსწავლისთვისაც ხილულია; მშობლის კომენტარი მხოლოდ მეურვეს ეგზავნება."
      className="gb-modal"
    >
      <form
        className="gb-form"
        onChange={() => setDirty(true)}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const f = new FormData(e.currentTarget);
          try {
            const x = await command({
              action: 'writing.save',
              revision: 0,
              kind,
              yearId,
              offeringId: kind === 'homeroom_note' ? null : offeringId,
              studentId: f.get('student'),
              body: f.get('body'),
            });
            setSaved(x);
            onSaved();
          } catch (err) {
            setError(errorText(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="gb-field">
          ჩანაწერის ტიპი
          <Select disabled={!!saved} value={kind} onChange={(e) => setKind(e.target.value)}>
            {canTeach && (
              <>
                <option value="guardian_note">საგნის მასწავლებლის კომენტარი მშობელს</option>
                <option value="narrative">წლიური განმავითარებელი შეფასება</option>
              </>
            )}
            {homeroom && <option value="homeroom_note">დამრიგებლის ზოგადი კომენტარი</option>}
          </Select>
        </label>
        <label className="gb-field">
          მოსწავლე
          <Select name="student" required disabled={!!saved}>
            {data.pupils.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="gb-field">
          {kind === 'narrative'
            ? 'პროგრესი · მიღწევები · საჭირო მხარდაჭერა'
            : 'აკადემიური კომენტარი'}
          <textarea
            name="body"
            required
            minLength={5}
            maxLength={5000}
            rows={6}
            disabled={!!saved}
          />
        </label>
        <div className="ux-feedback-slot">
          {error && (
            <p role="alert" className="gb-error">
              {error}
            </p>
          )}
        </div>
        {!saved ? (
          <Button type="submit" disabled={busy}>
            მონახაზის შენახვა
          </Button>
        ) : (
          <>
            <p>მონახაზი შენახულია. ოჯახისთვის ჯერ არ ჩანს.</p>
            <Button
              variant="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await command({ action: 'writing.publish', ...saved });
                  onSaved();
                  onClose();
                } catch (e) {
                  setError(errorText(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              გამოქვეყნება
            </Button>
          </>
        )}
      </form>
    </Modal>
  );
}
export function PolicyForm({
  course,
  semesterId,
  onSaved,
  onClose,
}: {
  course: Setup['offerings'][number];
  semesterId: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <Modal
      open
      onOpenChange={onClose}
      title="კურსის შეფასების წესი"
      description={`${course.section} · ${course.subject}. ცვლილება ქმნის ახალ ვერსიას; გამოქვეყნებული შეფასებები ინარჩუნებს ძველ წესს.`}
      className="gb-modal"
    >
      <form
        className="gb-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const f = new FormData(e.currentTarget);
          try {
            await command({
              action: 'policy.revise',
              offeringId: course.id,
              semesterId,
              revision: course.policy?.revision ?? 0,
              policy: course.policy?.policy ?? currentAssessmentPolicy,
              offeringMode: f.get('mode'),
              requiredSummatives: f.get('required') === '' ? null : Number(f.get('required')),
              requirementBasis: 'configured',
              reason: f.get('reason'),
            });
            onSaved();
            onClose();
          } catch (err) {
            setError(errorText(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="gb-field">
          შეფასების რეჟიმი
          <Select name="mode" defaultValue={course.policy?.offeringMode ?? 'policy_default'}>
            <option value="policy_default">საფეხურის წესი · 1–10 / განმავითარებელი</option>
            <option value="formative_only">მხოლოდ განმავითარებელი</option>
            <option value="pass_fail">ჩათვლა / არჩათვლა</option>
          </Select>
        </label>
        <label className="gb-field">
          სავალდებულო შემაჯამებლების რაოდენობა
          <input
            name="required"
            type="number"
            min={0}
            max={100}
            step={1}
            defaultValue={course.policy?.requiredSummatives ?? ''}
          />
        </label>
        <p className="gb-muted">
          ცარიელი მნიშვნელობა ნიშნავს დაუდგენელ მოთხოვნას. I–IV და V კლასის I სემესტრი რჩება
          განმავითარებელი.
        </p>
        <label className="gb-field">
          ცვლილების საფუძველი
          <textarea name="reason" required minLength={5} maxLength={1000} />
        </label>
        <div className="ux-feedback-slot">{error && <p role="alert">{error}</p>}</div>
        <Button variant="primary" disabled={busy} type="submit">
          ახალი ვერსიის შენახვა
        </Button>
      </form>
    </Modal>
  );
}
export function CriteriaForm({
  yearId,
  course,
  criteria,
  onSaved,
  onClose,
}: {
  yearId: string;
  course: Setup['offerings'][number];
  criteria: Criteria;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const latest = criteria
    .filter((c) => c.subjectId === course.subjectId)
    .sort((a, b) => b.revision - a.revision)[0];
  return (
    <Modal
      open
      onOpenChange={onClose}
      title="საგნის კრიტერიუმი"
      description="დამტკიცება ქმნის ახალ ვერსიას. ძველ შეფასებებს საკუთარი კრიტერიუმი რჩება."
      className="gb-modal"
    >
      <form
        className="gb-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const f = new FormData(e.currentTarget);
          try {
            let fileId: string | null = null;
            const file = f.get('file');
            if (file instanceof File && file.size) {
              const result = await api<{ id: string }>(
                `/api/gradebook/criteria/files?name=${encodeURIComponent(file.name)}`,
                { method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: file },
              );
              fileId = result.id;
            }
            await command({
              action: 'criteria.revise',
              subjectId: course.subjectId,
              yearId,
              revision: latest?.revision ?? 0,
              text: f.get('text'),
              fileId,
              reason: f.get('reason'),
            });
            onSaved();
            onClose();
          } catch (err) {
            setError(errorText(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <strong>{course.subject}</strong>
        <label className="gb-field">
          კრიტერიუმები
          <textarea
            name="text"
            required
            minLength={5}
            maxLength={12000}
            rows={7}
            defaultValue={latest?.text ?? ''}
          />
        </label>
        <label className="gb-field">
          დამხმარე დოკუმენტი · PDF, მაქს. 3 მბ
          <input type="file" name="file" accept="application/pdf,.pdf" />
        </label>
        <label className="gb-field">
          დამტკიცების საფუძველი
          <textarea name="reason" required minLength={5} maxLength={1000} />
        </label>
        <div className="ux-feedback-slot">{error && <p role="alert">{error}</p>}</div>
        <Button type="submit" variant="primary" disabled={busy}>
          კრიტერიუმის დამტკიცება
        </Button>
      </form>
    </Modal>
  );
}
