import { createContext, useContext, useState, type ReactNode } from 'react';
type Theme = 'light' | 'dark';
const PreferenceContext = createContext<{
  theme: Theme;
  setTheme: (value: Theme) => void;
  compact: boolean;
  setCompact: (value: boolean) => void;
}>({ theme: 'light', setTheme: () => {}, compact: false, setCompact: () => {} });
function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Private browsing may disable persistence. */
  }
}
export function Preferences({ children }: { children: ReactNode }) {
  const [theme, set] = useState<Theme>(() => (read('aia-theme') === 'dark' ? 'dark' : 'light'));
  const [compact, setDense] = useState(() => read('aia-compact') === 'true');
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.density = compact ? 'compact' : 'comfortable';
  return (
    <PreferenceContext.Provider
      value={{
        theme,
        compact,
        setTheme: (value) => {
          set(value);
          write('aia-theme', value);
        },
        setCompact: (value) => {
          setDense(value);
          write('aia-compact', String(value));
        },
      }}
    >
      {children}
    </PreferenceContext.Provider>
  );
}
export const usePreferences = () => useContext(PreferenceContext);
