import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { dateLabel } from '../../lib/format';
import { EmptyState, ErrorState, Skeleton, Button } from '../ui';
import { valueLabel, type Report, type Journal } from './model';
const reportLabels = {
  progress: 'მოსწავლის პროგრესი',
  provisional: 'სემესტრის წინასწარი შედეგები',
  distribution: 'ქულების განაწილება',
  summatives: 'შემაჯამებლები და აღდგენა',
  pass_fail: 'ჩათვლის მიმოხილვა',
  narratives: 'წლიური შეფასებების სისრულე',
  publication: 'გამოქვეყნების სისრულე',
  attendance: 'საგნის დასწრების კონტექსტი',
  annual: 'წლიური წინასწარი პროგნოზი',
  matrix: 'შეფასების მატრიცა',
} as const;
export function Reports({
  yearId,
  semesterId,
  offeringId,
  studentId,
  cohort,
  onOpen,
}: {
  yearId: string;
  semesterId: string;
  offeringId: string;
  studentId: string;
  cohort: boolean;
  onOpen: (id: string) => void;
}) {
  const [kind, setKind] = useState<keyof typeof reportLabels>('progress');
  const q = useQuery({
    queryKey: ['gradebook', 'report', kind, yearId, semesterId, offeringId, studentId],
    queryFn: () =>
      api<Report>(
        `/api/gradebook/reports/${kind}?yearId=${yearId}&semesterId=${semesterId}&offeringId=${offeringId}${studentId ? '&studentId=' + studentId : ''}`,
      ),
    enabled: !!offeringId,
  });
  return (
    <section className="gb-reports">
      <div className="gb-section-heading">
        <div>
          <span className="eyebrow">აკადემიური სურათი</span>
          <h2>{reportLabels[kind]}</h2>
        </div>
        <label className="gb-field">
          ანგარიში
          <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            {Object.entries(reportLabels)
              .filter(
                ([k]) =>
                  cohort || !['distribution', 'publication', 'narratives', 'matrix'].includes(k),
              )
              .map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
          </select>
        </label>
      </div>
      <p className="gb-muted">
        მხოლოდ გამოქვეყნებული შედეგები · თანაბარი წონა · წინასწარი მაჩვენებლები, არა ოფიციალური
        ნიშნები.
      </p>
      {!offeringId ? (
        <EmptyState title="აირჩიეთ საგნის კურსი" />
      ) : q.isPending ? (
        <Skeleton />
      ) : q.isError ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : (
        <ReportBody data={q.data} onOpen={onOpen} />
      )}
    </section>
  );
}
function ReportBody({ data, onOpen }: { data: Report; onOpen: (id: string) => void }) {
  if (data.kind === 'distribution' && 'distribution' in data)
    return (
      <>
        <div className="gb-report-total">
          <strong>{data.mean?.display ?? '—'}</strong>
          <span>ჯგუფის საშუალო · {data.scoreCount} ქულა · რეიტინგის გარეშე</span>
        </div>
        <div className="gb-distribution">
          {data.distribution?.map((d) => (
            <div key={d.score}>
              <span>{d.score}</span>
              <i style={{ width: `${Math.max(1, (d.count / (data.scoreCount || 1)) * 100)}%` }} />
              <strong>{d.count}</strong>
            </div>
          ))}
        </div>
      </>
    );
  if (data.kind === 'publication' && 'draft' in data)
    return (
      <div className="gb-statline">
        {[
          ['პირადი მონახაზი', data.draft],
          ['გამოქვეყნებული', data.published],
          ['გაუქმებული', data.voided],
        ].map(([label, n]) => (
          <div key={label}>
            <strong>{n}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
    );
  if (data.kind === 'matrix' && 'assessments' in data)
    return (
      <div className="gb-scroll">
        <table className="gb-table">
          <thead>
            <tr>
              <th>მოსწავლე</th>
              {data.assessments?.map((a) => (
                <th key={a.id}>{a.title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.pupils?.map((p) => (
              <tr key={p.id}>
                <th>{p.name}</th>
                {data.assessments?.map((a) => (
                  <td key={a.id}>
                    <button onClick={() => onOpen(a.id)}>
                      {valueLabel(a.entries.find((e) => e.studentId === p.id)?.value, true)}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  if ('rows' in data && data.rows)
    return (
      <div className="gb-report-rows">
        {data.rows.map((row) => (
          <article key={row.pupil.id}>
            <header>
              <strong>{row.pupil.name}</strong>
              <small>{row.pupil.number}</small>
            </header>
            <div>
              {'projection' in row && (
                <>
                  <strong className="gb-report-number">
                    {row.projection.mean?.display ?? '—'}{' '}
                    <small>→ {row.projection.mean?.rounded ?? '—'}</small>
                  </strong>
                  {row.projection.mean && (
                    <p>
                      ზუსტი საშუალო: {row.projection.mean.numerator} /{' '}
                      {row.projection.mean.denominator} · ნაჩვენებია ორ ათწილადამდე
                    </p>
                  )}
                  <p>
                    {row.projection.scoreCount} ქულა · {row.projection.completedSummatives}{' '}
                    დასრულებული შემაჯამებელი
                  </p>
                  <p>
                    {row.projection.incomplete
                      ? 'წინასწარი · არასრული'
                      : 'წინასწარი · არსებული მონაცემები შევსებულია'}
                    {row.projection.missingRequired === null
                      ? ' · მოთხოვნა დაუდგენელია'
                      : row.projection.missingRequired
                        ? ` · აკლია ${row.projection.missingRequired}`
                        : ''}
                  </p>
                </>
              )}
              {'recovery' in row &&
                row.recovery?.map((r) => (
                  <Button
                    key={r.assessmentId}
                    variant="ghost"
                    onClick={() => onOpen(r.assessmentId)}
                  >
                    {r.title}
                    {'deadline' in r && typeof r.deadline === 'string'
                      ? ` · ვადა ${dateLabel(r.deadline)}`
                      : ''}
                  </Button>
                ))}
              {'annual' in row && (
                <>
                  <strong className="gb-report-number">{row.annual.mean?.display ?? '—'}</strong>
                  <p>
                    სემესტრების მომრგვალებული შედეგებიდან · გამოცდის გარეშე
                    {row.annual.incomplete ? ' · არასრული' : ''}
                  </p>
                </>
              )}
              {'assessments' in row &&
                row.assessments?.map((a) => (
                  <p key={a.id}>
                    <button onClick={() => onOpen(a.id)}>
                      {a.title} · {valueLabel(a.value)}
                    </button>
                  </p>
                ))}
              {'published' in row && (
                <p>{row.published ? 'გამოქვეყნებულია' : 'წლიური შეფასება ჯერ არ გამოქვეყნებულა'}</p>
              )}
              {'recorded' in row && (
                <p>
                  {row.recorded} აღრიცხული გაკვეთილი · {row.attended} დასწრება · {row.missed}{' '}
                  გაცდენა · {row.late} დაგვიანება. შეუვსებელი გაკვეთილები არ ითვლება გაცდენად.
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    );
  return <EmptyState title="ამ ჭრილში მონაცემები ჯერ არ არის" />;
}
export function FamilyJournal({ data, onOpen }: { data: Journal; onOpen: (id: string) => void }) {
  return (
    <div className="gb-family-history">
      {data.items
        .filter((a) => a.status !== 'draft')
        .map((a) => (
          <button key={a.id} onClick={() => onOpen(a.id)}>
            <div className="gb-family-date">{dateLabel(a.date)}</div>
            <div>
              <strong>{a.title}</strong>
              <span>
                {a.labels.subject} · {a.labels.teacher}
              </span>
            </div>
            <div className="gb-family-score">
              {a.entries.map((e) => (
                <span key={e.studentId}>{valueLabel(e.value, true)}</span>
              ))}
              {a.status === 'void' && <small>გაუქმებულია</small>}
            </div>
          </button>
        ))}
      {!data.items.length && (
        <EmptyState
          title="გამოქვეყნებული შეფასებები ჯერ არ არის"
          description="მასწავლებლის მონახაზები პირადია. შედეგები გამოქვეყნების შემდეგ გამოჩნდება."
        />
      )}
    </div>
  );
}
