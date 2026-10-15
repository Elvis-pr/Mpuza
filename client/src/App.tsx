import React from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { OpportunitySection } from './components/OpportunitySection';
import { ResourceSection } from './components/ResourceSection';
import { Footer } from './components/Footer';
import { Splash } from './components/Splash';
import { ConnectPanel } from './components/ConnectPanel';
import { CallOverlay } from './components/CallOverlay';
import { ProfilePage } from './components/ProfilePage';
import { AuthProvider } from './lib/auth';

// Simple SPA routing for profile pages
function Router() {
  const [path, setPath] = React.useState(window.location.pathname);

  React.useEffect(() => {
    const handleRoute = () => {
      setPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleRoute);
    return () => window.removeEventListener('popstate', handleRoute);
  }, []);

  React.useEffect(() => {
    if (path === '/') {
      window.scrollTo(0, 0);
    }
  }, [path]);

  if (path.startsWith('/profiles/')) {
    const profileId = path.replace('/profiles/', '');
    return (
      <>
        <Splash />
        <div className="app">
          <Navbar />
          <main>
            <ProfilePage profileId={profileId} />
          </main>
          <Footer />
        </div>
        <ConnectPanel />
        <CallOverlay />
      </>
    );
  }

  return (
    <>
      <Splash />
      <div className="app">
        <Navbar />
        <main>
          <Hero />
          <section className="section" id="opportunities">
            <div className="container">
              <OpportunitySection />
            </div>
          </section>
          <section className="section" id="career-hub">
            <div className="container">
              <ResourceSection />
            </div>
          </section>
        </main>
        <Footer />
      </div>
      <ConnectPanel />
      <CallOverlay />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}
