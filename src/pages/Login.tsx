import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  ArrowUpRight,
  Sun,
  Moon,
  Eye,
  EyeOff,
  Pause,
  Play,
  LoaderCircle,
  LockKeyhole,
} from 'lucide-react';
import { api, signIn, ApiError } from '../lib/api';
import { usePreferences } from '../lib/preferences';
import { ProductMark, LensArtifact, useSchoolDate } from '../components/ProductIdentity';

export function Login({ onLogin }: { onLogin: () => void }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem('aia-login-email') ?? '';
    } catch {
      return '';
    }
  });
  const [remember, setRemember] = useState(Boolean(email));
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { theme, setTheme } = usePreferences();
  const today = useSchoolDate();
  const config = useQuery({
    queryKey: ['config'],
    queryFn: () => api<{ demo: boolean }>('/api/config'),
  });
  async function login(mail: string, pass: string) {
    if (busy) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail.trim()) || !pass) {
      setError('შეიყვანეთ სწორი ელფოსტა და პაროლი.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await signIn(mail.trim(), pass);
      // Identifier convenience only. Session persistence remains controlled by auth.
      try {
        if (remember) localStorage.setItem('aia-login-email', mail.trim());
        else localStorage.removeItem('aia-login-email');
      } catch {
        /* Storage may be unavailable. Login must still succeed. */
      }
      navigate('/', { replace: true });
      onLogin();
    } catch (error) {
      setError(
        error instanceof ApiError && error.status === 429
          ? 'შესვლის მცდელობების ლიმიტი ამოიწურა. მოიცადეთ ერთი წუთი და სცადეთ ხელახლა.'
          : 'შესვლა ვერ მოხერხდა. გადაამოწმეთ ელფოსტა, პაროლი და კავშირი.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={`product-theme product-login ${paused ? 'motion-paused' : ''}`}>
      <main className="entrance-composition">
        <div className="entrance-identity">
          <ProductMark />
        </div>
        <section className="entrance-story" aria-labelledby="entrance-title">
          <div className="entrance-place">
            <span>თბილისი, საქართველო</span>
            <span className="product-number">
              41°43′ N <i /> 44°47′ E
            </span>
          </div>
          <div className="entrance-date">
            <time dateTime={today.date} aria-label={`${today.label}, ${today.year}`}>
              <span>{today.day}</span>
              <i>/</i>
              <span>{today.month}</span>
            </time>
            <span>
              დღეს <i /> {today.year}
            </span>
          </div>
          <LensArtifact paused={paused} />
          <div className="entrance-headline">
            <span className="product-eyebrow">სივრცე შესაძლებლობებისთვის</span>
            <h1 id="entrance-title">
              <span>სკოლის დღე,</span> <span>ერთ სივრცეში.</span>
            </h1>
            <p>
              ადამიანები, სწავლა და გადაწყვეტილებები —<br />
              ყველაფერი მნიშვნელოვანი, ერთმანეთთან ახლოს.
            </p>
          </div>
          <footer className="entrance-story-footer">
            <span>
              <i /> საერთო ხედვა. შემდეგი ნაბიჯი.
            </span>
            <button
              className="product-icon"
              aria-label={paused ? 'ანიმაციის გაგრძელება' : 'ანიმაციის შეჩერება'}
              aria-pressed={paused}
              onClick={() => setPaused(!paused)}
            >
              {paused ? <Play size={15} /> : <Pause size={15} />}
            </button>
          </footer>
        </section>
        <section className="entrance-form-panel" aria-labelledby="login-title">
          <div className="entrance-utilities">
            <button
              className="product-icon"
              aria-label="ფერის რეჟიმის შეცვლა"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            >
              {theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}
            </button>
          </div>
          <div className="entrance-form-wrap">
            <div className="entrance-form-kicker">
              <span className="product-eyebrow">მოგესალმებით</span>
              <span className="entrance-entry-symbol" aria-hidden="true">
                <ArrowUpRight size={22} />
              </span>
            </div>
            <h2 id="login-title">
              თქვენი სამუშაო
              <br />
              სივრცე.
            </h2>
            <p className="entrance-form-intro">შედით და გააგრძელეთ თქვენი დღე.</p>
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void login(email, password);
              }}
              aria-busy={busy}
            >
              <label className="product-field">
                ელფოსტა
                <input
                  type="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  value={email}
                  disabled={busy}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="სახელი@სკოლა.ge"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'login-error' : undefined}
                />
              </label>
              <label className="product-field">
                პაროლი
                <span className="entrance-password">
                  <input
                    type={visible ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    disabled={busy}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="თქვენი პაროლი"
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? 'login-error' : undefined}
                  />
                  <button
                    type="button"
                    className="product-icon"
                    aria-label={visible ? 'პაროლის დამალვა' : 'პაროლის ჩვენება'}
                    aria-pressed={visible}
                    onClick={() => setVisible(!visible)}
                  >
                    {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </label>
              <div className="entrance-options">
                <label>
                  <input
                    type="checkbox"
                    checked={remember}
                    disabled={busy}
                    onChange={(e) => {
                      setRemember(e.target.checked);
                      if (!e.target.checked) {
                        try {
                          localStorage.removeItem('aia-login-email');
                        } catch {
                          /* Optional preference. */
                        }
                      }
                    }}
                  />
                  ელფოსტის დამახსოვრება
                </label>
                <Link to="/recovery">პაროლის აღდგენა</Link>
              </div>
              {error && (
                <p id="login-error" role="alert" className="entrance-error">
                  {error}
                </p>
              )}
              <button className="product-primary entrance-submit" disabled={busy}>
                {busy ? 'შესვლა…' : 'სივრცეში შესვლა'}
                {busy ? (
                  <LoaderCircle size={18} className="product-spinner" />
                ) : (
                  <ArrowRight size={18} />
                )}
              </button>
              <p className="entrance-help">
                <LockKeyhole size={14} />
                <span>ანგარიშზე წვდომისთვის მიმართეთ სკოლის ადმინისტრაციას.</span>
              </p>
            </form>
            {config.data?.demo && (
              <section className="entrance-demo" aria-label="სადემონსტრაციო ანგარიშები">
                <div className="entrance-demo-heading">
                  <span>გაეცანით სივრცეს</span>
                  <small>გამოგონილი მონაცემები</small>
                </div>
                <div className="entrance-demo-roles">
                  {[
                    { key: 'director', label: 'დირექტორი' },
                    { key: 'teacher', label: 'მასწავლებელი' },
                    { key: 'parent', label: 'მშობელი' },
                    { key: 'student', label: 'მოსწავლე' },
                  ].map((r) => (
                    <button
                      key={r.key}
                      disabled={busy}
                      onClick={() => void login(`${r.key}@demo.aia.local`, 'AiaDemo-2026!')}
                    >
                      <span>{r.label}</span>
                      <ArrowUpRight size={14} />
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
          <footer className="entrance-form-footer">
            <span>AIA-GESS</span>
            <span>
              თქვენი სასკოლო სივრცე <ArrowUpRight size={13} />
            </span>
          </footer>
        </section>
      </main>
    </div>
  );
}
