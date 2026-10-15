import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { OpportunitySection } from './components/OpportunitySection';
import { ResourceSection } from './components/ResourceSection';
import { Footer } from './components/Footer';
import { Splash } from './components/Splash';
import { ConnectPanel } from './components/ConnectPanel';
import { CallOverlay } from './components/CallOverlay';
import { AuthProvider } from './lib/auth';

export default function App() {
  return (
    <AuthProvider>
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
      {/* Connect suite: messenger dock + WebRTC call overlay */}
      <ConnectPanel />
      <CallOverlay />
    </AuthProvider>
  );
}
