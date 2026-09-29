import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AcademicSetup, StudentAdministration as StudentRecord } from '../../shared/stage1a';
import { api } from '../lib/api';
import { Button, ErrorState, Skeleton } from './ui';
import {
  Field,
  PersonFields,
  PersonPicker,
  OperationDialog,
  mutate,
  text,
  optional,
  today,
} from './Operations';
export function CreateStudent({ onClose }: { onClose: () => void }) {
  const [existing, setExisting] = useState(false);
  return (
    <OperationDialog
      title="მოსწავლის დამატება"
      description="შეიქმნება მოსწავლის პროფილი და პირველი ჩარიცხვა. მშობლები და ანგარიში ცალკე უკავშირდება პროფილს."
      onClose={onClose}
      onSave={(f) =>
        mutate('/api/people/actions', {
          action: 'student.create',
          ...(existing ? { personId: text(f, 'personId') } : {}),
          fullName: existing ? text(f, 'personIdLabel') : text(f, 'fullName'),
          contactEmail: optional(f, 'contactEmail'),
          number: text(f, 'number'),
          sectionId: text(f, 'sectionId'),
          startsOn: text(f, 'startsOn'),
        })
      }
    >
      <label className="op-check">
        <input type="checkbox" checked={existing} onChange={(e) => setExisting(e.target.checked)} />
        არსებული პიროვნების გამოყენება
      </label>
      {existing ? <PersonPicker kind="person" /> : <PersonFields />}
      <Field label="მოსწავლის ნომერი" name="number" />
      <EnrollmentSection />
      <Field label="ჩარიცხვის თარიღი" name="startsOn" type="date" value={today()} />
    </OperationDialog>
  );
}
export function StudentAdministration({ id }: { id: string }) {
  const result = useQuery({
    queryKey: ['student-administration', id],
    queryFn: () => api<StudentRecord>(`/api/people/students/${id}`),
  });
  const [mode, setMode] = useState<'edit' | 'transfer' | 'link' | 'guardian' | 'status' | null>(
      null,
    ),
    [ending, setEnding] = useState<string | null>(null);
  if (result.isPending) return <Skeleton />;
  if (result.isError) return <ErrorState onRetry={() => void result.refetch()} />;
  const s = result.data;
  return (
    <div className="op-student-admin">
      <div className="op-actions">
        <Button onClick={() => setMode('edit')}>პროფილის რედაქტირება</Button>
        <Button onClick={() => setMode('transfer')}>ჩარიცხვის შეცვლა</Button>
        <Button onClick={() => setMode('status')}>
          {s.status === 'active' ? 'არქივირება' : 'აღდგენა'}
        </Button>
      </div>
      <section className="op-history">
        <h3>ჩარიცხვის ისტორია</h3>
        {s.enrollments.map((e) => (
          <article key={e.id}>
            <strong>
              {e.sectionName} · {e.yearName}
            </strong>
            <span>
              {e.startsOn} — {e.endsOn ?? 'მოქმედი'}
            </span>
          </article>
        ))}
        {!s.enrollments.length && <p>ჩარიცხვა ჯერ არ არის.</p>}
      </section>
      <section className="op-history">
        <div className="op-section-heading">
          <h3>მშობლები / მეურვეები</h3>
          <Button onClick={() => setMode('link')}>დაკავშირება</Button>
        </div>
        {s.guardians.map((g) => (
          <article key={g.id}>
            <div>
              <strong>{g.name}</strong>
              <p>
                {g.startsOn} — {g.endsOn ?? 'მოქმედი'}
              </p>
            </div>
            {(!g.endsOn || g.endsOn > today()) && (
              <Button variant="ghost" onClick={() => setEnding(g.id)}>
                კავშირის დასრულება
              </Button>
            )}
          </article>
        ))}
        {!s.guardians.length && <p>დაკავშირებული მშობელი ჯერ არ არის.</p>}
        <Button variant="ghost" onClick={() => setMode('guardian')}>
          ახალი მშობლის შექმნა
        </Button>
      </section>
      {mode && (
        <OperationDialog
          title={
            {
              edit: 'მოსწავლის პროფილი',
              transfer: 'ჩარიცხვის შეცვლა',
              link: 'მშობლის დაკავშირება',
              guardian: 'მშობლის შექმნა',
              status: s.status === 'active' ? 'მოსწავლის არქივირება' : 'მოსწავლის აღდგენა',
            }[mode]
          }
          description={
            mode === 'transfer'
              ? 'წინა ჩარიცხვა დასრულდება მითითებულ დღეს. წარსული ისტორია შენარჩუნდება. გასვლისთვის აირჩიეთ „ჩარიცხვის დასრულება“.'
              : 'შეამოწმეთ პიროვნება და მოქმედების თარიღი. ყველა აქტიური მშობელი იღებს ჩვეულებრივ ოჯახურ წვდომას.'
          }
          onClose={() => setMode(null)}
          onSave={(f) => {
            if (mode === 'edit')
              return mutate('/api/people/actions', {
                action: 'student.edit',
                id,
                version: s.version,
                personVersion: s.personVersion,
                fullName: text(f, 'fullName'),
                contactEmail: optional(f, 'contactEmail'),
                number: text(f, 'number'),
              });
            if (mode === 'transfer')
              return mutate('/api/people/actions', {
                action: 'enrollment.change',
                studentId: id,
                version: s.version,
                sectionId: optional(f, 'sectionId'),
                effectiveOn: text(f, 'effectiveOn'),
                reason: text(f, 'reason'),
              });
            if (mode === 'link')
              return mutate('/api/people/actions', {
                action: 'guardian.link',
                studentId: id,
                guardianPersonId: text(f, 'guardianPersonId'),
                startsOn: text(f, 'startsOn'),
              });
            if (mode === 'guardian')
              return mutate('/api/people/actions', {
                action: 'person.create',
                fullName: text(f, 'fullName'),
                contactEmail: optional(f, 'contactEmail'),
              });
            return mutate('/api/people/actions', {
              action: 'student.status',
              id,
              version: s.version,
              status: s.status === 'active' ? 'archived' : 'active',
            });
          }}
        >
          {(mode === 'edit' || mode === 'guardian') && (
            <PersonFields
              fullName={mode === 'edit' ? s.name : ''}
              email={mode === 'edit' ? (s.contactEmail ?? '') : ''}
            />
          )}
          {mode === 'edit' && <Field label="მოსწავლის ნომერი" name="number" value={s.number} />}
          {mode === 'transfer' && (
            <>
              <EnrollmentSection allowWithdrawal />
              <Field label="ძალაში შესვლის თარიღი" name="effectiveOn" type="date" value={today()} />
              <Field label="ცვლილების მიზეზი" name="reason" />
            </>
          )}
          {mode === 'link' && (
            <>
              <PersonPicker name="guardianPersonId" label="მშობლის მოძებნა" />
              <Field label="კავშირის დასაწყისი" name="startsOn" type="date" value={today()} />
            </>
          )}
          {mode === 'status' && (
            <p>
              {s.name} · {s.number}. არქივირებამდე ჩარიცხვები უნდა დასრულდეს.
            </p>
          )}
        </OperationDialog>
      )}
      {ending && (
        <OperationDialog
          title="კავშირის დასრულება"
          description="მითითებული დღიდან მშობელს ამ კავშირით წვდომა აღარ ექნება. ისტორია შენარჩუნდება."
          onClose={() => setEnding(null)}
          onSave={(f) =>
            mutate('/api/people/actions', {
              action: 'guardian.end',
              id: ending,
              endsOn: text(f, 'endsOn'),
            })
          }
        >
          <Field label="დასრულების თარიღი" name="endsOn" type="date" value={today()} />
        </OperationDialog>
      )}
    </div>
  );
}

function EnrollmentSection({ allowWithdrawal = false }: { allowWithdrawal?: boolean }) {
  const [yearId, setYearId] = useState('');
  const setup = useQuery({
    queryKey: ['enrollment-sections', yearId],
    queryFn: () => api<AcademicSetup>(`/api/academics${yearId ? `?yearId=${yearId}` : ''}`),
  });
  if (setup.isPending) return <Skeleton />;
  if (setup.isError) return <ErrorState onRetry={() => void setup.refetch()} />;
  return (
    <>
      <label className="op-field">
        <span>სასწავლო წელი</span>
        <select value={setup.data.selectedYearId ?? ''} onChange={(e) => setYearId(e.target.value)}>
          {setup.data.years
            .filter((y) => y.status !== 'archived')
            .map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
        </select>
      </label>
      <Field
        key={setup.data.selectedYearId}
        label="მიმღები კლასი"
        name="sectionId"
        required={!allowWithdrawal}
      >
        <option value="">{allowWithdrawal ? 'ჩარიცხვის დასრულება' : 'აირჩიეთ კლასი'}</option>
        {setup.data.sections.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Field>
    </>
  );
}
