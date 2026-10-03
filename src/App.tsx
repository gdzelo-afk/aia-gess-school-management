import { useState, lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { Viewer } from '../shared/contracts';
import { api, ApiError } from './lib/api';
import { Shell } from './components/Shell';
import { Skeleton, ErrorState } from './components/ui';
import { Login } from './pages/Login';
const Attendance = lazy(() =>
  import('./pages/Attendance').then((m) => ({ default: m.Attendance })),
);
const Timetable = lazy(() => import('./pages/Timetable').then((m) => ({ default: m.Timetable })));
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Students = lazy(() => import('./pages/Students').then((m) => ({ default: m.Students })));
const Settings = lazy(() => import('./pages/OtherPages').then((m) => ({ default: m.Settings })));
const DesignGallery = lazy(() =>
  import('./pages/OtherPages').then((m) => ({ default: m.DesignGallery })),
);
const PlannedPage = lazy(() =>
  import('./pages/OtherPages').then((m) => ({ default: m.PlannedPage })),
);
const Academics = lazy(() =>
  import('./pages/AcademicManagement').then((m) => ({ default: m.AcademicManagement })),
);
const PeopleManagement = lazy(() =>
  import('./pages/PeopleManagement').then((m) => ({ default: m.PeopleManagement })),
);
const Accounts = lazy(() => import('./pages/Accounts').then((m) => ({ default: m.Accounts })));
const Activation = lazy(() =>
  import('./pages/Activation').then((m) => ({ default: m.Activation })),
);
const Messages = lazy(() => import('./pages/Workspaces').then((m) => ({ default: m.Messages })));
const Gradebook = lazy(() => import('./pages/Gradebook').then((m) => ({ default: m.Gradebook })));
export function App() {
  const [authVersion, setAuthVersion] = useState(0);
  const me = useQuery({
    queryKey: ['me', authVersion],
    queryFn: () => api<Viewer>('/api/me'),
    retry: false,
    refetchOnWindowFocus: true,
  });
  const refresh = () => setAuthVersion((v) => v + 1);
  if (me.isPending)
    return (
      <div className="initial-loading product-theme product-initial-loading">
        <img src="/logo.png" alt="აია-ჯესსი" />
        <Skeleton rows={3} />
      </div>
    );
  if (me.isError && !(me.error instanceof ApiError && me.error.status === 401))
    return (
      <div className="initial-loading product-theme product-initial-loading">
        <ErrorState onRetry={() => void me.refetch()} />
      </div>
    );
  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <div className="initial-loading product-theme product-initial-loading">
            <Skeleton />
          </div>
        }
      >
        <Routes>
          <Route path="activate" element={<Activation />} />
          <Route path="recovery" element={<Activation recovery />} />
          <Route
            path="*"
            element={
              !me.data ? (
                <Login onLogin={refresh} />
              ) : (
                <Routes>
                  <Route element={<Shell viewer={me.data} onLogout={refresh} />}>
                    <Route index element={<Dashboard />} />
                    <Route path="students" element={<Students />} />
                    <Route path="gradebook" element={<Gradebook />} />
                    <Route path="attendance" element={<Attendance />} />
                    <Route path="timetable" element={<Timetable />} />
                    <Route path="calendar" element={<Academics calendarOnly />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="design" element={<DesignGallery />} />
                    <Route path="academics" element={<Academics />} />
                    <Route path="staff" element={<PeopleManagement staff />} />
                    <Route path="guardians" element={<PeopleManagement />} />
                    <Route path="accounts" element={<Accounts />} />
                    <Route path="messages" element={<Messages />} />
                    {['finance', 'reports', 'community'].map((p) => (
                      <Route key={p} path={p} element={<PlannedPage />} />
                    ))}
                    <Route path="login" element={<Navigate to="/" replace />} />
                    <Route path="*" element={<PlannedPage />} />
                  </Route>
                </Routes>
              )
            }
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
