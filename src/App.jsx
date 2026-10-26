import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar/Navbar';
import Footer from './components/Footer/Footer';
import SearchModal from './components/SearchModal/SearchModal';
import ProfileModal from './components/ProfileModal/ProfileModal';
import HiddenTitlesModal from './components/HiddenTitlesModal/HiddenTitlesModal';
import AuthRequiredModal from './components/AuthRequiredModal/AuthRequiredModal';
import ScrollToTop from './components/ScrollToTop/ScrollToTop';

// Code Splitting via React.lazy for instant initial page loading & WPO
const Home = lazy(() => import('./pages/Home/Home'));
const Catalog = lazy(() => import('./pages/Catalog/Catalog'));
const Details = lazy(() => import('./pages/Details/Details'));
const Watch = lazy(() => import('./pages/Watch/Watch'));
const MyList = lazy(() => import('./pages/MyList/MyList'));
const Admin = lazy(() => import('./pages/Admin/Admin'));
const Login = lazy(() => import('./pages/Login/Login'));

import { AuthProvider } from './contexts/AuthContext';
import { ProfileProvider } from './contexts/ProfileContext';
import { WatchProgressProvider } from './contexts/WatchProgressContext';

const RouteLoadingFallback = () => (
  <div className="route-loading-fallback">
    <div className="player-spinner" />
    <span className="route-loading-text">Cargando experiencia...</span>
  </div>
);

const AppContent = () => {
  const location = useLocation();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Check if current page is theater watch mode
  const isWatchPage = location.pathname.startsWith('/watch/');

  // Global keyboard shortcut to open search modal ('/' or 'Ctrl+K')
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === '/' || (e.ctrlKey && (e.key === 'k' || e.key === 'K'))) &&
          !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="app-layout">
      {/* Auto-scroll to top on every navigation */}
      <ScrollToTop />

      {/* Navbar visible everywhere */}
      <Navbar onOpenSearch={() => setIsSearchOpen(true)} />

      {/* Global Modals */}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <ProfileModal />
      <HiddenTitlesModal />
      <AuthRequiredModal />

      {/* Application Routes with Code Splitting Suspense */}
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/anime/:id" element={<Details />} />
          <Route path="/watch/:id/:episode" element={<Watch />} />
          <Route path="/favorites" element={<MyList defaultTab="favorites" />} />
          <Route path="/my-list" element={<MyList defaultTab="mylist" />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </Suspense>

      {/* Hide footer in theater mode for clean full-screen viewing */}
      {!isWatchPage && <Footer />}
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <ProfileProvider>
        <WatchProgressProvider>
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </WatchProgressProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}

export default App;
