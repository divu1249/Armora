import React, { lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from './app/Theme.tsx';
import { ToastProvider } from './ui/Toast.tsx';
import { AppDataProvider } from './app/AppData.tsx';
import { AppShell } from './app/AppShell.tsx';
import { PublicLayout } from './pages/public/PublicLayout.tsx';

/**
 * Route table. Every page is loaded with React.lazy (route-level code splitting); only the two
 * layouts and the providers are in the entry bundle. Paths mirror src/lib/nav.ts (a test checks it).
 */
const Landing = lazy(() => import('./pages/public/LandingPage.tsx'));
const Pricing = lazy(() => import('./pages/public/PricingPage.tsx'));
const Docs = lazy(() => import('./components/pages/DocsPage.tsx'));
const NotFound = lazy(() => import('./pages/public/NotFoundPage.tsx'));

const Overview = lazy(() => import('./pages/app/OverviewPage.tsx'));
const Feed = lazy(() => import('./pages/app/FeedPage.tsx'));
const Incidents = lazy(() => import('./pages/app/IncidentsPage.tsx'));
const IncidentDetail = lazy(() => import('./pages/app/IncidentDetailPage.tsx'));
const Approvals = lazy(() => import('./pages/app/ApprovalsRoute.tsx'));
const Policies = lazy(() => import('./pages/app/PoliciesPage.tsx'));
const Credentials = lazy(() => import('./pages/app/CredentialsRoute.tsx'));
const Audit = lazy(() => import('./pages/app/AuditRoute.tsx'));
const RedTeam = lazy(() => import('./pages/app/RedTeamRoute.tsx'));
const Intelligence = lazy(() => import('./pages/app/IntelligenceRoute.tsx'));
const Traffic = lazy(() => import('./pages/app/TrafficRoute.tsx'));
const Mcp = lazy(() => import('./pages/app/McpRoute.tsx'));
const Compliance = lazy(() => import('./pages/app/ComplianceRoute.tsx'));
const Settings = lazy(() => import('./pages/app/SettingsPage.tsx'));
const Apps = lazy(() => import('./pages/app/AppsRoute.tsx'));
const Compare = lazy(() => import('./pages/app/CompareRoute.tsx'));
const RealVsSimulated = lazy(() => import('./pages/app/RealVsSimulatedRoute.tsx'));
const SelfTest = lazy(() => import('./pages/app/SelfTestRoute.tsx'));

const AppFrame: React.FC = () => (
  <AppDataProvider>
    <AppShell />
  </AppDataProvider>
);

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route index element={<Landing />} />
              <Route path="pricing" element={<Pricing />} />
              <Route path="docs" element={<Docs />} />
              <Route path="*" element={<NotFound />} />
            </Route>
            <Route path="app" element={<AppFrame />}>
              <Route index element={<Navigate to="overview" replace />} />
              <Route path="overview" element={<Overview />} />
              <Route path="feed" element={<Feed />} />
              <Route path="incidents" element={<Incidents />} />
              <Route path="incidents/:id" element={<IncidentDetail />} />
              <Route path="approvals" element={<Approvals />} />
              <Route path="policies" element={<Policies />} />
              <Route path="credentials" element={<Credentials />} />
              <Route path="audit" element={<Audit />} />
              <Route path="redteam" element={<RedTeam />} />
              <Route path="intelligence" element={<Intelligence />} />
              <Route path="traffic" element={<Traffic />} />
              <Route path="mcp" element={<Mcp />} />
              <Route path="compliance" element={<Compliance />} />
              <Route path="settings" element={<Settings />} />
              <Route path="apps" element={<Apps />} />
              <Route path="compare" element={<Compare />} />
              <Route path="real-vs-simulated" element={<RealVsSimulated />} />
              <Route path="selftest" element={<SelfTest />} />
              <Route path="*" element={<NotFound inApp />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
