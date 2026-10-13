import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { OpportunitySection } from './components/OpportunitySection';
import { ResourceSection } from './components/ResourceSection';
import { Footer } from './components/Footer';

export default function App() {
  return (
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
  );
}
