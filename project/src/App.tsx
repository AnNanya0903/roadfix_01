import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import AppProvider from '@/components/AppProvider';
import Footer from '@/components/Footer';
import { RequireRole } from '@/components/Guards';
import Navbar from '@/components/Navbar';
import { Loading } from '@/components/States';
import VirtualAssistant from '@/components/VirtualAssistant';
import { AboutPage, HowItWorksPage, ImpactPage, LandingPage } from '@/pages/PublicPages';
import { CitizenDashboard, MyReportsPage, NotificationsPage, ProfilePage } from '@/pages/CitizenPages';
import LoginPage from '@/pages/LoginPage';

// Map-heavy and analytics pages are split out so the landing page loads fast.
const ReportPage = lazy(() => import('@/pages/ReportPage'));
const IssueDetailPage = lazy(() => import('@/pages/IssueDetailPage'));
const MapPage = lazy(() => import('@/pages/MapPage'));
const ScanPage = lazy(() => import('@/pages/ScanPage'));
const AuthorityPages = lazy(() => import('@/pages/AuthorityPages'));

function AuthorityRoute({ page }: { page: 'overview' | 'incidents' | 'queue' | 'analytics' | 'assignments' | 'resolution' | 'map' }) {
  return (
    <RequireRole roles={['authority', 'admin']}>
      <Suspense fallback={<Loading />}><AuthorityPages page={page} /></Suspense>
    </RequireRole>
  );
}

function LegacyReportRedirect() {
  const { id } = useParams();
  return <Navigate to={`/issues/${id}`} replace />;
}

export default function App() {
  const routerBasename = import.meta.env.BASE_URL === '/' ? undefined : import.meta.env.BASE_URL.replace(/\/$/, '');
  return (
    <BrowserRouter basename={routerBasename}>
      <AppProvider>
        <div className="flex min-h-screen flex-col">
          <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[2000] focus:rounded focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
          <Navbar />
          <main id="main" className="flex-1">
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/how-it-works" element={<HowItWorksPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/impact" element={<ImpactPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/report" element={<ReportPage />} />
                <Route path="/report/:id" element={<LegacyReportRedirect />} />
                <Route path="/scan" element={<ScanPage />} />
                <Route path="/map" element={<MapPage />} />
                <Route path="/issues/:id" element={<IssueDetailPage />} />
                <Route path="/dashboard" element={<Navigate to="/app" replace />} />
                <Route path="/app" element={<RequireRole roles={['citizen', 'authority', 'admin']}><CitizenDashboard /></RequireRole>} />
                <Route path="/app/reports" element={<RequireRole roles={['citizen', 'authority', 'admin']}><MyReportsPage /></RequireRole>} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/authority" element={<AuthorityRoute page="overview" />} />
                <Route path="/authority/incidents" element={<AuthorityRoute page="incidents" />} />
                <Route path="/authority/map" element={<AuthorityRoute page="map" />} />
                <Route path="/authority/queue" element={<AuthorityRoute page="queue" />} />
                <Route path="/authority/analytics" element={<AuthorityRoute page="analytics" />} />
                <Route path="/authority/assignments" element={<AuthorityRoute page="assignments" />} />
                <Route path="/authority/resolution" element={<AuthorityRoute page="resolution" />} />
                <Route path="*" element={<div className="px-4 py-20 text-center"><h1 className="text-5xl font-bold">Page not found</h1><p className="mt-2 text-signal-gray">Check the address, or go back to the home page.</p></div>} />
              </Routes>
            </Suspense>
          </main>
          <Footer />
          <VirtualAssistant />
        </div>
      </AppProvider>
    </BrowserRouter>
  );
}
