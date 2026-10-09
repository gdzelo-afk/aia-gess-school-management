import { useSearchQuery } from '../lib/use-search-query';
import { Select } from '../components/Select';
import { useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  ArrowUpDown,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  UsersRound,
  ShieldCheck,
} from 'lucide-react';
import type { StudentPage, StudentRow, Viewer } from '../../shared/contracts';
import type { AcademicSetup } from '../../shared/stage1a';
import { CreateStudent, StudentAdministration } from '../components/StudentAdministration';
import { api } from '../lib/api';
import { money } from '../lib/format';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Modal,
  EmptyState,
  ErrorState,
  Skeleton,
} from '../components/ui';
export function Students() {
  const { viewer } = useOutletContext<{ viewer: Viewer }>();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState('active');
  const canManage = viewer.capabilities.includes('people:manage');
  const setup = useQuery({
    queryKey: ['academics', viewer.id],
    queryFn: () => api<AcademicSetup>('/api/academics'),
  });
  const [section, setSection] = useState('');
  const [sort, setSort] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const id = params.get('student');
  const search = useSearchQuery(q);
  const result = useQuery<StudentPage>({
    queryKey: ['students', viewer.id, search, section, sort, page, status],
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === viewer.id ? previous : undefined,
    queryFn: ({ signal }) =>
      api<StudentPage>(
        `/api/foundation/students?q=${encodeURIComponent(search)}&sort=${sort}&offset=${page * 6}&limit=6&status=${status}${section ? `&section=${encodeURIComponent(section)}` : ''}`,
        { signal },
      ),
    enabled: q === search,
  });
  const refreshing = q !== search || result.isPlaceholderData;
  const detail = useQuery({
    queryKey: ['student', id, viewer.id],
    queryFn: () => api<StudentRow>(`/api/foundation/students/${id}`),
    enabled: Boolean(id),
    retry: false,
  });
  const finance = useQuery({
    queryKey: ['finance-preview', id, viewer.id],
    queryFn: () =>
      api<{ demo: boolean; amountTetri?: number; invoiceNumber?: string }>(
        `/api/foundation/students/${id}/finance-preview`,
      ),
    enabled:
      Boolean(id) && detail.isSuccess && viewer.capabilities.some((c) => c.startsWith('finance:')),
    retry: false,
  });
  const title = viewer.roles.includes('guardian')
    ? 'ჩემი შვილები'
    : viewer.roles.includes('student')
      ? 'ჩემი ბარათი'
      : 'მოსწავლეები';
  return (
    <>
      <div className="page-intro">
        <div>
          <div className="page-kicker">ადამიანები · სასკოლო სივრცე</div>
          <h1>{title}</h1>
          <p>მოსწავლეთა ჩანაწერები და მოქმედი ჩარიცხვები — თქვენი უფლებამოსილების ფარგლებში.</p>
        </div>
        {canManage && <Button onClick={() => setCreating(true)}>მოსწავლის დამატება</Button>}
        <Badge>
          <UsersRound size={14} />
          {result.data?.total ?? '—'} ჩანაწერი
        </Badge>
      </div>
      <Card className="directory-card">
        <div className="directory-toolbar">
          <div className="input-with-icon">
            <Search size={17} />
            <input
              aria-label="მოსწავლის ძიება"
              placeholder="სახელი ან მოსწავლის ნომერი…"
              value={q}
              maxLength={100}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <label className="filter-select">
            <span className="sr-only">კლასის ფილტრი</span>
            <Select
              value={section}
              onChange={(e) => {
                setSection(e.target.value);
                setPage(0);
              }}
            >
              <option value="">ყველა კლასი</option>
              {setup.data?.sections.map((s) => (
                <option key={s.id}>{s.name}</option>
              ))}
            </Select>
          </label>
          {canManage && (
            <label className="filter-select">
              <Select
                aria-label="მოსწავლის სტატუსი"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(0);
                }}
              >
                <option value="active">აქტიური</option>
                <option value="archived">არქივში</option>
                <option value="all">ყველა</option>
              </Select>
            </label>
          )}
        </div>
        {result.isPending ? (
          <Skeleton />
        ) : result.isError ? (
          <ErrorState onRetry={() => void result.refetch()} />
        ) : result.data.items.length ? (
          <>
            <div
              className="table-scroll ux-refresh-region"
              aria-busy={refreshing}
              inert={refreshing}
              role="region"
              aria-label="მოსწავლეთა სია"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th aria-sort={sort === 'asc' ? 'ascending' : 'descending'}>
                      <button
                        className="sort-button"
                        onClick={() => {
                          setSort(sort === 'asc' ? 'desc' : 'asc');
                          setPage(0);
                        }}
                      >
                        მოსწავლე
                        <ArrowUpDown size={13} />
                      </button>
                    </th>
                    <th>პირადი ნომერი სკოლაში</th>
                    <th>კლასი</th>
                    <th>სტატუსი</th>
                    <th>
                      <span className="sr-only">მიმოხილვა</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.items.map((s, i) => (
                    <tr key={s.id} data-selected={id === s.id || undefined}>
                      <td>
                        <button
                          className="person-cell"
                          onClick={() => setParams({ student: s.id })}
                        >
                          <Avatar name={s.name} color={i} />
                          <strong>{s.name}</strong>
                        </button>
                      </td>
                      <td className="product-number muted">{s.number}</td>
                      <td>{s.section ?? '—'}</td>
                      <td>
                        <Badge tone={s.status === 'active' ? 'success' : 'neutral'}>
                          {s.status === 'active' ? 'აქტიური' : 'არქივში'}
                        </Badge>
                      </td>
                      <td>
                        <button
                          className="icon-button"
                          aria-label={`${s.name} — მიმოხილვა`}
                          onClick={() => setParams({ student: s.id })}
                        >
                          <ArrowUpRight size={17} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span role="status">
                {refreshing
                  ? 'ახლდება…'
                  : `${page * 6 + 1}–${Math.min(page * 6 + 6, result.data.total)} / ${result.data.total} ჩანაწერი`}
              </span>
              <div>
                <Button
                  aria-label="წინა გვერდი"
                  disabled={page === 0 || refreshing}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft size={16} />
                </Button>
                <span>{page + 1}</span>
                <Button
                  aria-label="შემდეგი გვერდი"
                  disabled={refreshing || (page + 1) * 6 >= result.data.total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            title="ჩანაწერი ვერ მოიძებნა"
            description="შეცვალეთ საძიებო სიტყვა ან კლასის ფილტრი."
            action={
              <Button
                onClick={() => {
                  setQ('');
                  setSection('');
                  setPage(0);
                }}
              >
                ფილტრების გასუფთავება
              </Button>
            }
          />
        )}
      </Card>
      <div className="privacy-caption">
        <ShieldCheck size={16} />
        <p>ხილულია მხოლოდ თქვენი როლით ნებადართული მონაცემები. ჩარიცხვის ისტორია ინახება.</p>
      </div>
      {creating && <CreateStudent onClose={() => setCreating(false)} />}
      <Modal
        open={Boolean(id)}
        onOpenChange={(open) => {
          if (!open) setParams({});
        }}
        title="მოსწავლის მიმოხილვა"
        description="სასკოლო პროფილი და ჩარიცხვის კონტექსტი"
        className="student-dialog"
      >
        {detail.isPending ? (
          <Skeleton rows={3} />
        ) : detail.isError ? (
          <EmptyState
            denied
            title="ჩანაწერი მიუწვდომელია"
            description="მოსწავლე ვერ მოიძებნა ან ამ ჩანაწერზე წვდომა არ გაქვთ."
          />
        ) : (
          detail.data && (
            <>
              <div className="student-detail-head">
                <Avatar name={detail.data.name} />
                <div>
                  <h2>{detail.data.name}</h2>
                  <p>
                    {detail.data.number} · {detail.data.section}
                  </p>
                </div>
                <Badge tone={detail.data.status === 'active' ? 'success' : 'neutral'}>
                  {detail.data.status === 'active' ? 'აქტიური' : 'არქივში'}
                </Badge>
              </div>
              {canManage && <StudentAdministration id={detail.data.id} />}
              {finance.data?.demo && (
                <div className="finance-example">
                  <span>
                    <small>გადასახადის მაგალითი</small>
                    <strong>{finance.data.invoiceNumber}</strong>
                  </span>
                  <strong>{money(finance.data.amountTetri ?? 0)}</strong>
                </div>
              )}
            </>
          )
        )}
      </Modal>
    </>
  );
}
