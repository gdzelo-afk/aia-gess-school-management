import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Button } from '../components/ui';
export function Activation({ recovery = false }: { recovery?: boolean }) {
  const [token] = useState(() => window.location.hash.slice(1));
  useEffect(() => {
    if (token) window.history.replaceState(null, '', window.location.pathname);
  }, [token]);
  const config = useQuery({
    queryKey: ['config'],
    queryFn: () => api<{ localDelivery: boolean }>('/api/config'),
  });
  const [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState('');
  return (
    <main className="product-theme op-access">
      <Link to="/login" className="brand">
        <img src="/logo.png" alt="აია-ჯესსის ემბლემა" />
        <strong>AIA-GESS</strong>
      </Link>
      <div className="op-access-form">
        <span className="product-eyebrow">თქვენი სასკოლო სივრცე</span>
        <h1>{recovery ? 'ანგარიშის აღდგენა' : 'ანგარიშის გააქტიურება'}</h1>
        {done ? (
          <>
            <p role="status">
              {recovery
                ? 'მოთხოვნა მიღებულია. შესაბამისი აქტიური ანგარიშის ბმული ხელმისაწვდომია ლოკალური მიწოდების საქაღალდეში; ელფოსტა არ იგზავნება.'
                : 'პაროლი შენახულია. შედით ახალი პაროლით.'}
            </p>
            <Link to="/login">შესვლაზე დაბრუნება →</Link>
          </>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setError('');
              if (!recovery && f.get('password') !== f.get('confirm')) {
                setError('პაროლები არ ემთხვევა.');
                return;
              }
              setBusy(true);
              try {
                await api(recovery ? '/api/onboarding/recovery' : '/api/onboarding/activate', {
                  method: 'POST',
                  body: JSON.stringify(
                    recovery ? { email: f.get('email') } : { token, password: f.get('password') },
                  ),
                });
                setDone(true);
              } catch (e) {
                setError(e instanceof Error ? e.message : 'მოთხოვნა ვერ შესრულდა.');
              } finally {
                setBusy(false);
              }
            }}
          >
            {recovery ? (
              <label className="op-field">
                <span>ანგარიშის ელფოსტა</span>
                <input name="email" type="email" autoComplete="email" required />
              </label>
            ) : (
              <>
                <p>აირჩიეთ მინიმუმ 12-სიმბოლოიანი პაროლი. ბმული ერთჯერადია.</p>
                <label className="op-field">
                  <span>ახალი პაროლი</span>
                  <input
                    name="password"
                    type="password"
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                    required
                  />
                </label>
                <label className="op-field">
                  <span>გაიმეორეთ პაროლი</span>
                  <input
                    name="confirm"
                    type="password"
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                    required
                  />
                </label>
              </>
            )}
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            <Button
              variant="primary"
              disabled={busy || (!recovery && !token) || (recovery && !config.data?.localDelivery)}
            >
              {busy ? 'მუშავდება…' : recovery ? 'აღდგენის მოთხოვნა' : 'პაროლის შენახვა'}
            </Button>
            {recovery && !config.data?.localDelivery && (
              <p>აღდგენის მიწოდება ჯერ არ არის გამართული. მიმართეთ სკოლის ადმინისტრატორს.</p>
            )}
            {!recovery && !token && <p role="alert">ბმული აკლია. მოითხოვეთ ახალი მოწვევა.</p>}
          </form>
        )}
      </div>
    </main>
  );
}
