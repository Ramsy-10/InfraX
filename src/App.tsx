import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { CustomCursor } from './components/CustomCursor';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Footer } from './components/Footer';
import { Navbar } from './components/Navbar';
import { SiteDataProvider } from './context/SiteDataContext';
import { AdminRoute } from './pages/admin/AdminRoute';
import { CompetitionDetailPage } from './pages/CompetitionDetailPage';
import { CompetitionsPage } from './pages/CompetitionsPage';
import { HomePage } from './pages/HomePage';
import { TimelinePage } from './pages/TimelinePage';
import { VotingPage } from './pages/VotingPage';

function AppLayout() {
  const location = useLocation();
  const isVotingRoute = location.pathname === '/vote' || location.pathname === '/voting';
  const isAdminRoute = location.pathname.startsWith('/admin');
  const hidePublicChrome = isVotingRoute || isAdminRoute;

  return (
    <div className="flex min-h-screen flex-col bg-[#050505] text-white">
      <CustomCursor />
      {!hidePublicChrome && <Navbar />}
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/competitions" element={<CompetitionsPage />} />
          <Route path="/competitions/:slug" element={<CompetitionDetailPage />} />
          <Route path="/timeline" element={<TimelinePage />} />
          <Route path="/vote" element={<VotingPage />} />
          <Route path="/voting" element={<VotingPage />} />
          <Route path="/admin" element={<AdminRoute />} />
          <Route path="/admin/*" element={<Navigate to="/admin" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {!hidePublicChrome && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SiteDataProvider>
        <BrowserRouter>
          <AppLayout />
        </BrowserRouter>
      </SiteDataProvider>
    </ErrorBoundary>
  );
}
