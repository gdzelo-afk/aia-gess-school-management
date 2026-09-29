import { Link, useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Layers3,
  MessageSquare,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import type { FoundationOverview, Viewer } from '../../shared/contracts';
import { api } from '../lib/api';
import { navigation } from '../components/navigation';
import { Badge, ErrorState, Skeleton } from '../components/ui';

export function Academics() {
  const { viewer } = useOutletContext<{ viewer: Viewer }>();
  const result = useQuery({
    queryKey: ['overview', viewer.id],
    queryFn: () => api<FoundationOverview>('/api/foundation/overview'),
  });
  const title = navigation(viewer).find((n) => n.path === '/academics')!.label;
  return (
    <>
      <header className="page-intro">
        <div>
          <div className="page-kicker">სასწავლო სივრცე</div>
          <h1>{title}</h1>
          <p>სასწავლო სტრუქტურა და დღის კონტექსტი — ერთი სამუშაო გარემო.</p>
        </div>
        <Badge>მომზადების ეტაპი</Badge>
      </header>
      <div className="academic-workspace">
        <section className="academic-structure" aria-labelledby="academic-structure-title">
          <div className="workspace-section-heading">
            <Layers3 size={19} />
            <h2 id="academic-structure-title">სასწავლო სტრუქტურა</h2>
          </div>
          <p className="workspace-boundary">
            ამ ეტაპზე ხელმისაწვდომია მხოლოდ მიმოხილვა. მართვის ფუნქციები ჯერ არ არის დამატებული.
          </p>
          {result.isPending ? (
            <Skeleton rows={3} />
          ) : result.isError ? (
            <ErrorState onRetry={() => void result.refetch()} />
          ) : (
            <div className="academic-year">
              <span>სასწავლო წელი</span>
              <strong className="product-number">{result.data.academicYear}</strong>
              <small>
                {result.data.demo ? 'სადემონსტრაციო მონაცემები' : 'მიმდინარე კონტექსტი'}
              </small>
            </div>
          )}
          <div className="academic-sections">
            {[
              [
                'კლასები და ჯგუფები',
                'კლასების, პარალელებისა და მოსწავლეთა შემადგენლობის მართვა შემდეგ ეტაპზე დაემატება. ამჟამად ჩანაწერების ნახვა შესაძლებელია მოსწავლეთა სივრცეში.',
              ],
              [
                'საგნები და სემესტრები',
                'საგნების შეთავაზებები, სწავლების განაწილება და სემესტრის წესები ჯერ არ იმართება ამ ეკრანიდან.',
              ],
              [
                'განრიგი და შეფასებები',
                'კალენდარში წარმოდგენილია დღის ნიმუში. გაკვეთილების, დასწრებისა და შეფასებების წარმოება ჯერ არ არის ხელმისაწვდომი.',
              ],
            ].map(([label, description], i) => (
              <details key={label}>
                <summary>
                  <span className="product-number">0{i + 1}</span>
                  <h3>{label}</h3>
                  <small>დაგეგმილია</small>
                  <ChevronDown size={16} />
                </summary>
                <p>{description}</p>
              </details>
            ))}
          </div>
        </section>
        <aside className="academic-context">
          <span className="product-eyebrow">ხელმისაწვდომია ახლა</span>
          <h2>
            გააგრძელეთ <br />
            სასკოლო სივრცეში.
          </h2>
          {viewer.capabilities.some((c) => c.startsWith('students:')) && (
            <Link to="/students">
              <UsersRound size={19} />
              <span>
                <strong>
                  {viewer.roles.includes('student')
                    ? 'ჩემი ბარათი'
                    : viewer.roles.includes('guardian')
                      ? 'ჩემი შვილები'
                      : 'მოსწავლეთა სია'}
                </strong>
                <small>თქვენთვის ხელმისაწვდომი ჩანაწერები</small>
              </span>
              <ArrowUpRight size={17} />
            </Link>
          )}
          <Link to="/calendar">
            <CalendarDays size={19} />
            <span>
              <strong>დღის კალენდარი</strong>
              <small>სადემონსტრაციო განრიგი</small>
            </span>
            <ArrowUpRight size={17} />
          </Link>
          <p className="workspace-footnote">
            <ShieldCheck size={16} />
            წვდომა განისაზღვრება თქვენი როლითა და სასკოლო კავშირებით.
          </p>
        </aside>
      </div>
    </>
  );
}

export function Messages() {
  return (
    <>
      <header className="page-intro">
        <div>
          <div className="page-kicker">კომუნიკაცია</div>
          <h1>შეტყობინებები</h1>
          <p>სკოლის, მასწავლებლებისა და ოჯახების საერთო საკომუნიკაციო სივრცე.</p>
        </div>
        <Badge>მომზადების ეტაპი</Badge>
      </header>
      <section className="messages-workspace" aria-label="შეტყობინებების სივრცე">
        <aside className="conversation-index">
          <div className="workspace-section-heading">
            <MessageSquare size={18} />
            <h2>მიმოწერა</h2>
          </div>
          <div className="conversation-unavailable">
            <span className="conversation-index-rule" />
            <h3>მიმოწერა ჯერ არ არის ჩართული</h3>
            <p>
              საძიებო სია და წაუკითხავი შეტყობინებები გამოჩნდება კომუნიკაციის მოდულის ამოქმედების
              შემდეგ.
            </p>
          </div>
          <span className="conversation-index-note">
            <ShieldCheck size={15} />
            დაცული სასკოლო კომუნიკაცია
          </span>
        </aside>
        <div className="conversation-stage">
          <div className="conversation-stage-header">
            <span>საკომუნიკაციო სივრცე</span>
            <span>დაგეგმილია</span>
          </div>
          <div className="conversation-empty">
            <span className="conversation-symbol">
              <MessageSquare size={30} />
            </span>
            <span className="product-eyebrow">საუბრისთვის განკუთვნილი ადგილი</span>
            <h2>
              ყველაფერი მნიშვნელოვანი,
              <br />
              ერთ საუბარში.
            </h2>
            <p>
              პირადი მიმოწერა, მიმღებების არჩევა და ფაილების გაგზავნა ჯერ არ არის ხელმისაწვდომი. აქ
              რეალური ან გამოგონილი საუბრები არ ინახება.
            </p>
            <Link className="product-secondary" to="/">
              მიმოხილვაზე დაბრუნება
              <ArrowUpRight size={16} />
            </Link>
          </div>
          <footer className="conversation-stage-footer">
            <BookOpen size={16} />
            <span>სადემონსტრაციო სასკოლო სიახლეები ხელმისაწვდომია მთავარ მიმოხილვაში.</span>
          </footer>
        </div>
      </section>
    </>
  );
}
